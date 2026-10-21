/**
 * Double number line's domain: the activity's check and its misses, and the scene the tutor reads. The boss
 * (`doubleNumberLine.boss.ts`) builds the assignment.
 *
 * Pure: the component and any probe read the same scene. Each challenge asks for the bottom value at one or more top
 * values; the learner types it and presses Check, and the activity's own check (±0.1) is the judge. The tutor is never
 * handed the bottom value a target asks for.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { DoubleNumberLineChallenge, LinkedPoint } from './DoubleNumberLine';
import type { DoubleNumberLineMiss } from './doubleNumberLine.card';

export { RATIO_LINE_MISSES_BY_MODE, type DoubleNumberLineMiss } from './doubleNumberLine.card';

/** The activity's tolerance since birth. */
export const RATIO_TOLERANCE = 0.1;

export const fmt = (n: number) => String(Math.round(n * 100) / 100);
const near = (a: number, b: number) => Math.abs(a - b) <= RATIO_TOLERANCE;

/** The given points other than the origin (the pair the item states). */
export const givenPairs = (ch: DoubleNumberLineChallenge): LinkedPoint[] =>
  ch.givenPoints.filter(p => !(p.topValue === 0 && p.bottomValue === 0));

/** The ratio the item states: bottom per 1 top, from its first non-origin given pair. */
export function itemRate(ch: DoubleNumberLineChallenge): number | null {
  const g = givenPairs(ch)[0];
  return g && g.topValue !== 0 ? g.bottomValue / g.topValue : null;
}

/** The activity's own check: every target's typed bottom value within the tolerance. */
export function valuesCorrect(ch: DoubleNumberLineChallenge, values: readonly string[]): boolean {
  if (values.length !== ch.targetPoints.length) return false;
  return ch.targetPoints.every((t, i) => {
    const v = parseFloat(values[i] ?? '');
    return Number.isFinite(v) && near(v, t.bottomValue);
  });
}

/** The learner's work in their terms, never the key. */
export function describeRatioWork(ch: DoubleNumberLineChallenge, values: readonly string[], bottomLabel: string, topLabel: string): string {
  const parts = ch.targetPoints.map((t, i) => {
    const v = (values[i] ?? '').trim();
    return v === '' || !Number.isFinite(parseFloat(v))
      ? `nothing typed yet for ${bottomLabel} at ${topLabel} = ${fmt(t.topValue)}`
      : `typed ${v} for ${bottomLabel} at ${topLabel} = ${fmt(t.topValue)}`;
  });
  return parts.join('; ');
}

/** A find-the-rate item: its target sits at top 1. */
export const asksForRate = (ch: DoubleNumberLineChallenge) => ch.targetPoints.some(t => near(t.topValue, 1));

export function ratioLineMiss(ch: DoubleNumberLineChallenge, values: readonly string[]): DoubleNumberLineMiss | undefined {
  if (valuesCorrect(ch, values)) return undefined;
  const at = ch.targetPoints.findIndex((t, i) => { const v = parseFloat(values[i] ?? ''); return !Number.isFinite(v) || !near(v, t.bottomValue); });
  const target = ch.targetPoints[at];
  const v = parseFloat(values[at] ?? '');
  if (!target || !Number.isFinite(v)) return undefined;
  const t = target.topValue, b = target.bottomValue, r = itemRate(ch) ?? (t !== 0 ? b / t : 0);
  const g = givenPairs(ch).find(p => !near(p.topValue, 1));
  if (asksForRate(ch) && g) {
    if (g.bottomValue !== 0 && near(v, g.topValue / g.bottomValue)) return 'inverted_rate';
    if (near(v, g.topValue * g.bottomValue)) return 'multiplied_not_divided';
    if (near(v, g.bottomValue)) return 'gave_given';
    if (near(v, g.bottomValue - g.topValue)) return 'subtracted';
  }
  if (near(v, t)) return 'gave_top';
  if (!near(t, 1) && near(v, r)) return 'stopped_at_rate';
  if (g && near(v, g.bottomValue)) return 'gave_given';
  if (near(v, t + r)) return 'added_rate';
  if (g && near(v, g.bottomValue + (t - g.topValue))) return 'added_difference';
  if (near(Math.abs(v - b), r)) return 'one_unit_off';
  return v > b ? 'too_high' : 'too_low';
}

export interface DoubleNumberLineView {
  topLabel: string;
  bottomLabel: string;
  contextQuestion: string;
  values: readonly string[];
  showVerticalGuides: boolean;
  showUnitRate: boolean;
  showTickLabels: 'all' | 'endpoints' | 'none';
  showGivenValues: boolean;
}

const isUnitRateGiven = (p: LinkedPoint) => near(p.topValue, 1) && p.label === 'Unit Rate';

/** What is drawn and asked. The bottom value a target asks for is never named. */
export function workspaceScene(ch: DoubleNumberLineChallenge, view: DoubleNumberLineView): SceneOf {
  const { topLabel, bottomLabel } = view;
  const given = givenPairs(ch).filter(p => !isUnitRateGiven(p) || view.showUnitRate).map(p => (
    isUnitRateGiven(p) ? `a yellow unit-rate point: ${topLabel} 1 matches ${bottomLabel} ${fmt(p.bottomValue)}`
      : `a given point: ${topLabel} ${fmt(p.topValue)} matches ${bottomLabel} ${fmt(p.bottomValue)}`
        + (view.showGivenValues ? '' : ` (its ${bottomLabel} value is not printed on the line; the question states it)`)));
  const facts: Record<string, string> = {
    lines: `top line ${topLabel}, 0 to ${fmt(ch.topScale.max)}; bottom line ${bottomLabel}, 0 to ${fmt(ch.bottomScale.max)}; `
      + 'both start at 0 and are drawn so that matching values line up one above the other',
    ...(view.contextQuestion ? { context: view.contextQuestion } : {}),
    ask: ch.prompt,
    given: given.length ? given.join('; ') : 'only the start, 0 matches 0',
    target: ch.targetPoints.map(t => `${topLabel} ${fmt(t.topValue)} is marked on the top line; the learner types the ${bottomLabel} value that matches it`).join('; '),
    onLines: [
      view.showTickLabels === 'all' ? 'every top tick is labelled; the bottom line is labelled only at its ends and the given values'
        : 'only the end ticks are labelled',
      'a bottom tick under the asked point, if there is one, shows ?',
      view.showVerticalGuides ? 'faint vertical guides under the given points' : 'no vertical guides',
    ].join('; '),
    learnerWork: describeRatioWork(ch, view.values, bottomLabel, topLabel),
    // How the learner answers is the card's `moves`; only what is this item's own is said here.
    constraints: 'An answer within 0.1 of the key counts. A bottom value the lines do not label is the learner\'s to work out.',
  };
  return { objects: [], facts };
}

/**
 * The journey row's typed answers (`liveJourneySpec.ts`): the key, or the item's signature miss (the given bottom
 * value on a find-the-rate item, else the top value plus the rate), else the key plus the rate.
 */
export function ratioLineHarnessValues(ch: DoubleNumberLineChallenge, intent: 'correct' | 'wrong'): string[] {
  if (intent === 'correct') return ch.targetPoints.map(t => fmt(t.bottomValue));
  const r = itemRate(ch) ?? 1, g = givenPairs(ch).find(p => !near(p.topValue, 1));
  return ch.targetPoints.map(t => {
    const signature = asksForRate(ch) && g ? g.bottomValue : t.topValue + r;
    return fmt(near(signature, t.bottomValue) ? t.bottomValue + r : signature);
  });
}

/** The input's accessible name, shared by the component and the journey row. */
export const answerLabel = (bottomLabel: string, topLabel: string, top: number) => `${bottomLabel} when ${topLabel} is ${fmt(top)}`;
