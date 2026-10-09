/**
 * double-number-line's in-item levers (/add-support-tiers; report qa/eval-reports/double-number-line-levers-2026-10-09.md).
 * The misses are what `ratioLineMiss` observes in the typed number; there is no real-learner evidence.
 *
 * - `unit_jumps` (help, every item that asks at a top value of 2 or more): equal unlabelled jumps from 0 to the asked
 *   point on both lines, one per step of 1 on top; the jumps below are all one size (the rate, never printed).
 * - `split_given` (help, items with a non-unit given pair: find_missing, unit_rate): the stretch from 0 to the given
 *   pair cut into equal parts on both lines, one per step of 1 on top, with unlabelled marks.
 * - `grow_model` (help, both): a picture outside the item, with no number: equal jumps on top paired with equal,
 *   bigger jumps below, captioned that the bottom grows by repeating the jump, not by adding once.
 * - `smaller_ask` (simplify): the same mode on the same lines with a friendlier ask, built here: equivalent_ratios
 *   asks at top 2; find_missing asks at twice the given pair's top (a whole-number scale, no rate needed); unit_rate's
 *   later items ask for the unit rate itself. unit_rate's find-the-rate item has none: any easier find-the-rate on
 *   the same lines has the same answer.
 *
 * Leak rules (code): no lever text, caption or scene fact carries a digit; the drawn jumps and marks are unlabelled;
 * a practice item has its own id and prompt, keeps the mode, and asks at a different top value with a bottom value
 * outside the tolerance of every one the item asks for.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { DoubleNumberLineChallenge } from './DoubleNumberLine';
import {
  RATIO_LINE_MISSES_BY_MODE, RATIO_TOLERANCE, asksForRate, fmt, givenPairs, itemRate, type DoubleNumberLineMiss,
} from './doubleNumberLineWorkspace';

export const UNIT_JUMPS_LEVER = 'unit_jumps';
export const SPLIT_GIVEN_LEVER = 'split_given';
export const GROW_MODEL_LEVER = 'grow_model';
export const SMALLER_ASK_LEVER = 'smaller_ask';

const SIMPLER = '~simpler';
export const isPracticeLine = (c: Pick<DoubleNumberLineChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

/** The most jumps or parts a lever draws: past this the marks crowd the line. */
const MAX_PARTS = 20;
const whole = (n: number) => Math.abs(n - Math.round(n)) < 1e-9;

/** The non-unit given pair the item states (find_missing, unit_rate), if any. */
export const nonUnitGiven = (c: DoubleNumberLineChallenge) => givenPairs(c).find(p => Math.abs(p.topValue - 1) > 1e-9);

/** `unit_jumps` can draw: one asked point at a whole top value of 2 or more. */
export function jumpsFor(c: DoubleNumberLineChallenge): { steps: number; rate: number } | null {
  const rate = itemRate(c), t = c.targetPoints[0]?.topValue;
  if (rate === null || c.targetPoints.length !== 1 || t === undefined || !whole(t) || t < 2 || t > MAX_PARTS) return null;
  return { steps: Math.round(t), rate };
}

/** `split_given` can draw: a non-unit given pair at a whole top value of 2 or more. */
export function splitFor(c: DoubleNumberLineChallenge): { parts: number; top: number; bottom: number } | null {
  const g = nonUnitGiven(c);
  if (!g || !whole(g.topValue) || g.topValue < 2 || g.topValue > MAX_PARTS) return null;
  return { parts: Math.round(g.topValue), top: g.topValue, bottom: g.bottomValue };
}

/**
 * The easier practice item for `c` (same mode, same lines, a friendlier ask), or null when the item is already the
 * friendliest of its mode or no such item fits the lines.
 */
export interface LineLabels { topLabel: string; bottomLabel: string }

export function simplerLine(c: DoubleNumberLineChallenge, { topLabel: top, bottomLabel: bottom }: LineLabels): DoubleNumberLineChallenge | null {
  if (isPracticeLine(c) || c.targetPoints.length !== 1) return null;
  const rate = itemRate(c);
  const t = c.targetPoints[0].topValue;
  if (rate === null) return null;
  const at = (top: number) => ({ topValue: top, bottomValue: Math.round(top * rate * 100) / 100, label: `Find for ${fmt(top)}` });
  const base = { ...c, id: `${c.id}${SIMPLER}`, hint: '' };
  let practice: DoubleNumberLineChallenge | null = null;
  if (c.challengeType === 'equivalent_ratios') {
    if (t <= 2) return null;
    practice = { ...base, targetPoints: [at(2)],
      prompt: `Practice first: the unit rate is 1 ${top} = ${fmt(rate)} ${bottom}. Use it to find ${bottom} when ${top} = 2.` };
  } else if (c.challengeType === 'find_missing') {
    const g = nonUnitGiven(c);
    if (!g) return null;
    const asked = g.topValue * 2;
    if (asked > c.topScale.max || Math.abs(asked - t) < 1e-9) return null;
    practice = { ...base, targetPoints: [at(asked)],
      prompt: `Practice first: given ${fmt(g.topValue)} ${top} = ${fmt(g.bottomValue)} ${bottom}, find ${bottom} when ${top} = ${fmt(asked)}.` };
  } else if (c.challengeType === 'unit_rate') {
    if (asksForRate(c)) return null;
    const g = nonUnitGiven(c);
    if (!g) return null;
    practice = { ...base, targetPoints: [{ topValue: 1, bottomValue: Math.round(rate * 100) / 100, label: 'Unit Rate' }],
      prompt: `Practice first: given ${fmt(g.topValue)} ${top} = ${fmt(g.bottomValue)} ${bottom}, find the unit rate: when ${top} = 1, what is ${bottom}?` };
  }
  return practice && !practiceLeaks(c, practice) ? practice : null;
}

/** Leak rule for a practice item: never the learner's item (its id, its prompt), the same mode, a different top value,
 *  and no bottom value within the tolerance of one the item asks for. */
export function practiceLeaks(parent: DoubleNumberLineChallenge, practice: DoubleNumberLineChallenge): boolean {
  if (practice.id === parent.id || practice.prompt === parent.prompt || practice.challengeType !== parent.challengeType) return true;
  return practice.targetPoints.some(p => parent.targetPoints.some(t =>
    Math.abs(p.topValue - t.topValue) < 1e-9 || Math.abs(p.bottomValue - t.bottomValue) <= RATIO_TOLERANCE))
    || practice.targetPoints.some(p => p.topValue > practice.topScale.max || p.bottomValue > practice.bottomScale.max);
}

// ── declarations ─────────────────────────────────────────────────────────

export function ratioLineLevers(c: DoubleNumberLineChallenge | null, pulled: readonly string[], labels: LineLabels): WorkspaceLever[] {
  if (!c || isPracticeLine(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly DoubleNumberLineMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const all = RATIO_LINE_MISSES_BY_MODE[c.challengeType] ?? [];
  const rateItem = asksForRate(c);
  const jumps = jumpsFor(c), split = splitFor(c), simpler = simplerLine(c, labels);
  const additive: DoubleNumberLineMiss[] = ['added_rate', 'added_difference', 'subtracted'];
  return [
    ...(split ? [lever(SPLIT_GIVEN_LEVER, 'help', 'shown', rateItem ? all : all.filter(m => ['gave_given', 'added_rate', 'added_difference', 'too_high', 'too_low'].includes(m)),
      'The learner cannot get from the given pair to one step on the top line.',
      'Cuts the stretch from the start to the given pair into equal parts on both lines, one part for each step of one on the '
        + 'top line, with unlabelled marks. No value is written; the learner works out what one part below is worth.')] : []),
    ...(jumps ? [lever(UNIT_JUMPS_LEVER, 'help', 'shown', all.filter(m => !['inverted_rate', 'multiplied_not_divided', 'subtracted'].includes(m)),
      'The learner types a number that does not match the asked point: the top value, the rate once, or the rate added once.',
      'Draws equal jumps from the start to the asked point on both lines, one jump for each step of one on the top line; the '
        + 'jumps below are all the same size. No jump or mark is labelled; the learner works out the jump size and how '
        + 'many jumps there are.')] : []),
    lever(GROW_MODEL_LEVER, 'help', 'both', all.filter(m => additive.includes(m)),
      'The learner adds once instead of scaling.',
      'Shows a picture outside the item, with no numbers: equal jumps on a top line paired with equal, bigger jumps on '
        + 'a bottom line, captioned that the bottom grows by repeating the same jump, not by adding once. Read the caption '
        + 'aloud. It is not the item: do not work the item\'s numbers on it.'),
    ...(simpler ? [lever(SMALLER_ASK_LEVER, 'simplify', 'shown', all.filter(m => !['inverted_rate', 'multiplied_not_divided'].includes(m)),
      'This ask is too far along the lines yet.',
      c.challengeType === 'unit_rate'
        ? 'Opens an easier item first on the same lines: find what matches one step on the top line. It is not graded; the '
          + 'full item comes back after it.'
        : c.challengeType === 'find_missing'
          ? 'Opens an easier item first on the same lines: an ask that is a whole number of copies of the given pair. It is not '
            + 'graded; the full item comes back after it.'
          : 'Opens an easier item first on the same lines: an ask closer to the start. It is not graded; the full item comes '
            + 'back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor and JEV. No digit, no answer. */
export function leverFacts(c: DoubleNumberLineChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeLine(c)) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    on(UNIT_JUMPS_LEVER) && 'Equal jumps are drawn from the start to the asked point on both lines, one for each step of one on the top line; the jumps below are all one size. Nothing is labelled.',
    on(SPLIT_GIVEN_LEVER) && 'The stretch from the start to the given pair is cut into equal parts on both lines, one for each step of one on the top line, with unlabelled marks.',
    on(GROW_MODEL_LEVER) && 'Beside the lines is a picture outside the item, with no numbers: equal jumps on top paired with equal, bigger jumps below, captioned that the bottom grows by repeating the jump, not by adding once.',
  ].filter((s): s is string => !!s).join(' ');
}

/** The caption under the `grow_model` picture. */
export const GROW_MODEL_CAPTION = 'Each jump on top matches one same-size jump below. The bottom line grows by repeating that jump, not by adding once.';

/** Leak rule for the levers' words, captions and facts: no digit at all (every key is a number). */
export const leverTextLeaks = (text: string) => /\d/.test(text);
