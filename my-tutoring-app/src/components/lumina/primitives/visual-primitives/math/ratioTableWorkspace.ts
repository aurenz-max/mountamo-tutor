/**
 * Ratio table on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C15).
 *
 * Pure: the component and any probe read the same assignment and scene. Every mode is a gesture item checked by the
 * activity's own Check: a typed number (missing value, multiplier, unit rate) within the item's tolerance, or the
 * slider's multiplier (build ratio) within twice it. The tutor is never handed the answer: not the hidden value, not
 * the multiplier a find or build item asks for, not the unit rate a unit-rate item asks for.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { RatioTableChallenge } from './RatioTable';

export type RatioType = RatioTableChallenge['type'];

/** Catalog eval mode -> the challenge type it generates. */
export const RATIO_MODE_TYPES: Record<string, RatioType> = {
  build_ratio: 'build-ratio', missing_value: 'missing-value', find_multiplier: 'find-multiplier', unit_rate: 'unit-rate',
};

/** The slider's span and step (the build-ratio control). */
export const SLIDER_MIN = 0.5;
export const SLIDER_STEP = 0.1;

export function formatNum(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * The build-ratio ask, built by code: the base ratio and ONE scaled value to reach (the second row's, or the first
 * row's when the second is not a clean number). It never names the multiplier, which is the item's answer.
 */
export function buildRatioAsk(c: Pick<RatioTableChallenge, 'baseRatio' | 'rowLabels' | 'targetMultiplier'>): string {
  const [a, b] = c.baseRatio, [A, B] = c.rowLabels, k = c.targetMultiplier;
  const clean = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
  const useSecond = clean(b * k) || !clean(a * k);
  const [value, label] = useSecond ? [b * k, B] : [a * k, A];
  return `The base ratio is ${formatNum(a)} to ${formatNum(b)} (${A} to ${B}). Move the slider to build an equivalent ratio where `
    + `${label} is ${formatNum(Math.round(value * 100) / 100)}.`;
}

const tolOf = (ch: RatioTableChallenge) => ch.tolerance ?? 1;

/** The answer the activity checks against: the hidden value, the multiplier, or the unit rate. */
export function ratioKey(ch: RatioTableChallenge): number {
  const [a, b] = ch.baseRatio, k = ch.targetMultiplier;
  switch (ch.type) {
    case 'missing-value': return (ch.hiddenValue === 'scaled-first' ? a : b) * k;
    case 'unit-rate': return a !== 0 ? b / a : 0;
    default: return k;
  }
}

/** Percent error of `value` against `target` (the activity's own measure). */
const percentOff = (value: number, target: number) =>
  target !== 0 ? Math.abs((value - target) / target) * 100 : value === 0 ? 0 : 100;

/** Within the item's own band: the typed modes use the tolerance, the slider twice it. */
export function matchesKey(ch: RatioTableChallenge, value: number): boolean {
  return percentOff(value, ratioKey(ch)) <= (ch.type === 'build-ratio' ? tolOf(ch) * 2 : tolOf(ch));
}

/** The learner's work: the number typed, or where the slider is. */
export interface RatioWork {
  typed: string;
  multiplier: number;
}

/** The activity's own check. An empty or non-numeric entry is not a check at all (the caller does not commit it). */
export function ratioCorrect(ch: RatioTableChallenge, work: RatioWork): boolean {
  if (ch.type === 'build-ratio') return matchesKey(ch, work.multiplier);
  const n = parseFloat(work.typed);
  return Number.isFinite(n) && matchesKey(ch, n);
}

/** The multiplier the header names on a missing-value item, or null when naming it would name the answer (the hidden
 *  row's base is 1, so its scaled value IS the multiplier). */
export function shownMultiplier(ch: RatioTableChallenge): number | null {
  if (ch.type !== 'missing-value') return null;
  return formatNum(ch.targetMultiplier) === formatNum(ratioKey(ch)) ? null : ch.targetMultiplier;
}

/** The unit-rate banner is drawn when the session asks for it, never on a unit-rate item, and never when its number
 *  is this item's answer (a find-multiplier item whose rate equals its multiplier). */
export function bannerShown(ch: RatioTableChallenge, showUnitRate: boolean): boolean {
  if (!showUnitRate || ch.type === 'unit-rate') return false;
  const [a, b] = ch.baseRatio;
  return a !== 0 && formatNum(b / a) !== formatNum(ratioKey(ch));
}

/** The learner's work in words, never the key. */
export function describeRatioWork(ch: RatioTableChallenge, work: RatioWork): string {
  if (ch.type === 'build-ratio') {
    const [a, b] = ch.baseRatio, m = work.multiplier;
    return `the slider is at ×${formatNum(m)}, making ${formatNum(a * m)} ${ch.rowLabels[0]} and ${formatNum(b * m)} ${ch.rowLabels[1]}`;
  }
  const t = work.typed.trim();
  return t ? `typed ${t}` : 'nothing typed yet';
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the number typed or the slider, drawn from the
 * catalog's commonStruggles (scaling one value only, adding instead of multiplying, no unit rate, multiplier and unit
 * rate confused):
 * - missing value: `added_difference` the known row's change added, not multiplied; `unscaled` the hidden row's base
 *   value copied; `copied_known` the other row's scaled value copied; `unit_rate` the per-1 rate typed;
 *   `multiplier` the multiplier typed;
 * - find multiplier: `difference` a row's scaled value minus its base (adding thinking); `scaled_value` a scaled value
 *   typed; `unit_rate` the per-1 rate typed; `inverse` base ÷ scaled, the multiplier upside down;
 * - unit rate: `inverse_rate` the first quantity ÷ the second; `difference` second minus first; `typed_quantity`
 *   one of the two quantities typed;
 * - build ratio: `one_step_off` the slider one whole step from the multiplier;
 * - every mode: `near_miss` within 10%, else `too_high` / `too_low`.
 */
export type RatioMiss = 'added_difference' | 'unscaled' | 'copied_known' | 'unit_rate' | 'multiplier'
  | 'difference' | 'scaled_value' | 'inverse' | 'inverse_rate' | 'typed_quantity' | 'one_step_off'
  | 'near_miss' | 'too_high' | 'too_low';

const SIZE: readonly RatioMiss[] = ['near_miss', 'too_high', 'too_low'];
export const RATIO_MISSES_BY_MODE: Record<string, readonly RatioMiss[]> = {
  build_ratio: ['one_step_off', ...SIZE],
  missing_value: ['added_difference', 'unscaled', 'copied_known', 'unit_rate', 'multiplier', ...SIZE],
  find_multiplier: ['difference', 'scaled_value', 'unit_rate', 'inverse', ...SIZE],
  unit_rate: ['inverse_rate', 'difference', 'typed_quantity', ...SIZE],
};

/** The values each signature miss stands for on this item, most specific first. Shared by the check and the harness. */
export function signatureValues(ch: RatioTableChallenge): Array<[RatioMiss, number]> {
  const [a, b] = ch.baseRatio, k = ch.targetMultiplier;
  if (ch.type === 'missing-value') {
    const first = ch.hiddenValue === 'scaled-first';
    const hiddenBase = first ? a : b, knownBase = first ? b : a, knownScaled = knownBase * k;
    return [['added_difference', hiddenBase + (knownScaled - knownBase)], ['unscaled', hiddenBase], ['copied_known', knownScaled],
      ['unit_rate', first ? a / b : b / a], ['multiplier', k]];
  }
  if (ch.type === 'find-multiplier') {
    return [['difference', a * k - a], ['difference', b * k - b], ['scaled_value', a * k], ['scaled_value', b * k],
      ['unit_rate', b / a], ['inverse', 1 / k]];
  }
  if (ch.type === 'unit-rate') {
    return [['inverse_rate', a / b], ['difference', b - a], ['typed_quantity', b], ['typed_quantity', a]];
  }
  return [['one_step_off', k + 1], ['one_step_off', k - 1]];
}

export function ratioMiss(ch: RatioTableChallenge, work: RatioWork): RatioMiss | undefined {
  if (ratioCorrect(ch, work)) return undefined;
  const value = ch.type === 'build-ratio' ? work.multiplier : parseFloat(work.typed);
  if (!Number.isFinite(value)) return undefined;
  const key = ratioKey(ch);
  for (const [miss, v] of signatureValues(ch)) {
    // Within the item's band, or the same to two places (an inverted rate like 4 ÷ 52 is typed 0.08).
    if (v > 0 && !matchesKey(ch, v) && (percentOff(value, v) <= Math.max(tolOf(ch), 1) || Math.abs(value - v) < 0.005 + 1e-9)) return miss;
  }
  if (percentOff(value, key) <= 10) return 'near_miss';
  return value > key ? 'too_high' : 'too_low';
}

export function workspaceAssignment(ch: RatioTableChallenge): TeachingAssignment {
  return { id: ch.id, task: ch.instruction, response: 'gesture' };
}

/** What the session draws beside the table (its support tier's starting position). */
export interface RatioTableView extends RatioWork {
  showUnitRate: boolean;
  showBarChart: boolean;
}

const KIND: Record<RatioType, string> = {
  'missing-value': 'missing value: find the hidden number in the scaled column',
  'find-multiplier': 'find the multiplier: what both base numbers were multiplied by',
  'build-ratio': 'build a ratio: set the multiplier slider so the scaled column matches the question',
  'unit-rate': 'unit rate: how many of the second quantity go with 1 of the first',
};

/** What is drawn and asked. The hidden value, the asked multiplier and the asked unit rate are never named. */
export function workspaceScene(ch: RatioTableChallenge, view: RatioTableView): WorkspaceScene {
  const [a, b] = ch.baseRatio, [A, B] = ch.rowLabels, k = ch.targetMultiplier;
  const facts: Record<string, string> = {
    kind: KIND[ch.type],
    baseColumn: `${formatNum(a)} ${A} to ${formatNum(b)} ${B}`,
  };
  if (ch.type === 'unit-rate') {
    facts.secondColumn = `${B} per ${A}: ${formatNum(b)} ÷ ${formatNum(a)} = ?`;
  } else if (ch.type === 'build-ratio') {
    const m = view.multiplier;
    facts.scaledColumn = `×${formatNum(m)} (follows the slider): ${formatNum(a * m)} ${A}, ${formatNum(b * m)} ${B}`;
    facts.slider = `multiplier from ×${SLIDER_MIN} in steps of ${SLIDER_STEP}`;
  } else if (ch.type === 'find-multiplier') {
    facts.scaledColumn = `×?: ${formatNum(a * k)} ${A}, ${formatNum(b * k)} ${B}`;
  } else {
    const shown = shownMultiplier(ch);
    const first = ch.hiddenValue === 'scaled-first';
    facts.scaledColumn = `×${shown === null ? '?' : formatNum(shown)}: ${first ? '?' : formatNum(a * k)} ${A}, `
      + `${first ? formatNum(b * k) : '?'} ${B}`;
  }
  facts.aids = [
    bannerShown(ch, view.showUnitRate) ? `a unit-rate banner showing how many ${B} per 1 ${A}` : 'no unit-rate banner',
    view.showBarChart && ch.type !== 'unit-rate' ? 'a bar chart of both columns (a hidden value\'s bar is labelled ?)' : 'no bar chart',
  ].join('; ');
  facts.learnerWork = describeRatioWork(ch, view);
  facts.constraints = ch.type === 'build-ratio'
    ? 'The learner moves the multiplier slider (or uses the arrow keys) and presses Check. The activity checks it itself. '
      + 'You cannot move the slider or press Check.'
    : 'The learner types a number in the answer box and presses Check. The activity checks it itself, within a small '
      + 'rounding band. You cannot type, or press Check.';
  return { objects: [], facts };
}

/** The input a journey row performs: a number typed, or the slider set. */
export type RatioHarnessInput = { kind: 'type'; text: string } | { kind: 'slide'; value: number };

/**
 * The journey row's input (`liveJourneySpec.ts`). `correct`: the key (rounded to two places when typed). `wrong`: the
 * item's first signature miss that the control can show and that is not itself right, else half again too high.
 */
export function ratioHarnessInput(ch: RatioTableChallenge, intent: 'correct' | 'wrong', maxMultiplier = 10): RatioHarnessInput {
  const key = ratioKey(ch);
  const asInput = (v: number): RatioHarnessInput => ch.type === 'build-ratio'
    ? { kind: 'slide', value: Math.round(v / SLIDER_STEP) * SLIDER_STEP }
    : { kind: 'type', text: formatNum(Math.round(v * 100) / 100) };
  if (intent === 'correct') return asInput(key);
  const reachable = (v: number) => ch.type !== 'build-ratio' || (v >= SLIDER_MIN && v <= maxMultiplier);
  const signature = signatureValues(ch).find(([, v]) => v > 0 && reachable(v) && !matchesKey(ch, Math.round(v * 100) / 100));
  const fallback = ch.type === 'build-ratio' && key * 1.5 > maxMultiplier ? key / 2 : key * 1.5;
  return asInput(signature ? signature[1] : fallback);
}
