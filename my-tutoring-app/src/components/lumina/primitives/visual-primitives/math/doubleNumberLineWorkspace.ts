/**
 * Double number line on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C15).
 *
 * Pure: the component and any probe read the same assignment and scene. Each challenge asks for the bottom value at
 * one or more top values; the learner types it and presses Check, and the activity's own check (±0.1) is the judge.
 * The tutor is never handed the bottom value a target asks for.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { DoubleNumberLineChallenge, LinkedPoint } from './DoubleNumberLine';

/** The activity's tolerance since birth. */
export const RATIO_TOLERANCE = 0.1;

export const fmt = (n: number) => String(Math.round(n * 100) / 100);
const near = (a: number, b: number) => Math.abs(a - b) <= RATIO_TOLERANCE;

export function workspaceAssignment(ch: DoubleNumberLineChallenge): TeachingAssignment {
  return { id: ch.id, task: ch.prompt, response: 'gesture' };
}

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

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the first target typed wrong, drawn from the
 * catalog's commonStruggles (adding instead of multiplying, not finding the unit rate, scaling errors):
 * - `gave_top`: the top value typed back as the bottom one;
 * - `stopped_at_rate`: the unit rate typed, not scaled to the asked top value;
 * - `gave_given`: the given pair's bottom value copied;
 * - `inverted_rate` (a find-the-rate item): top divided by bottom; `multiplied_not_divided`: the given pair's two
 *   values multiplied; `subtracted`: the given pair's top taken from its bottom;
 * - `added_rate`: the top value plus the rate (added once, not multiplied);
 * - `added_difference`: the given pair's difference carried over (bottom + the change in top), additive thinking;
 * - `one_unit_off`: one rate too many or too few (a skip-count slip);
 * - `too_high` / `too_low`: any other number.
 */
export type DoubleNumberLineMiss = 'gave_top' | 'stopped_at_rate' | 'gave_given' | 'inverted_rate' | 'multiplied_not_divided'
  | 'subtracted' | 'added_rate' | 'added_difference' | 'one_unit_off' | 'too_high' | 'too_low';

export const RATIO_LINE_MISSES_BY_MODE: Record<string, readonly DoubleNumberLineMiss[]> = {
  equivalent_ratios: ['gave_top', 'stopped_at_rate', 'added_rate', 'one_unit_off', 'too_high', 'too_low'],
  find_missing: ['gave_top', 'stopped_at_rate', 'gave_given', 'added_rate', 'added_difference', 'one_unit_off', 'too_high', 'too_low'],
  unit_rate: ['gave_top', 'stopped_at_rate', 'gave_given', 'inverted_rate', 'multiplied_not_divided', 'subtracted', 'added_rate',
    'added_difference', 'one_unit_off', 'too_high', 'too_low'],
};

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
export function workspaceScene(ch: DoubleNumberLineChallenge, view: DoubleNumberLineView): WorkspaceScene {
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
    constraints: 'The learner types a number in the box under the lines (or steps it with - and +) and presses Check. '
      + 'The activity checks it itself. You cannot type or press Check.',
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
