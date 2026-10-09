/**
 * Percent bar on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C15).
 *
 * Pure: the component and any probe read the same assignment and scene. A challenge is one or more steps, each
 * answered on the screen (the bar set to a percent, or one option tapped) and checked by the activity's own Check.
 * A right step opens the next step of the same challenge and is not a commit; a wrong step, and the last step
 * right, are. The tutor is never handed a step's target percent or which option is right.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { PercentBarChallenge, PercentBarChallengeType, PercentBarPlaceStep, PercentBarStep } from './PercentBar';

/** ±2 percentage points, the activity's tolerance since birth. */
export const PERCENT_TOLERANCE = 2;

/** The step list: a single-step challenge synthesises one place step from its own fields. */
export function challengeSteps(ch: PercentBarChallenge): PercentBarStep[] {
  if (ch.steps && ch.steps.length > 0) return ch.steps;
  return [{
    kind: 'place', prompt: ch.question, wholeValue: ch.wholeValue, wholeValueLabel: ch.wholeValueLabel,
    targetPercent: ch.targetPercent, maxPercent: ch.maxPercent, hint: ch.hint,
  }];
}

export function workspaceAssignment(ch: PercentBarChallenge): TeachingAssignment {
  const steps = challengeSteps(ch);
  const ask = steps.length > 1
    ? `${ch.scenario} Work it in ${steps.length} steps, pressing Check after each: ${steps.map(s => s.prompt).join(' ')}`
    : `${ch.scenario} ${steps[0]?.prompt ?? ch.question}`;
  return { id: ch.id, task: ask, response: 'gesture' };
}

/** The learner's work on the current step. */
export interface PercentWork {
  stepIndex: number;
  /** Where the bar is set now, in percent. */
  percent: number;
  /** The option id tapped on a choice step. */
  selected: string | null;
}

export interface PercentBarView extends PercentWork {
  /** Steps already checked right on this challenge, as the recap card shows them. */
  established: readonly { label: string; percent: number; value: number }[];
  showPercentLabels: boolean;
  showValueLabels: boolean;
  showCalculation: boolean;
  benchmarkLines: readonly number[];
  doubleBar: boolean;
}

export const withinTolerance = (percent: number, target: number) => Math.abs(percent - target) <= PERCENT_TOLERANCE;

/** The activity's own check of the current step. */
export function stepCorrect(ch: PercentBarChallenge, work: PercentWork): boolean {
  const step = challengeSteps(ch)[work.stepIndex];
  if (!step) return false;
  return step.kind === 'place' ? withinTolerance(work.percent, step.targetPercent) : work.selected === step.correctOptionId;
}

const stepLabel = (ch: PercentBarChallenge, i: number) => {
  const n = challengeSteps(ch).length;
  return n > 1 ? `Step ${i + 1} of ${n}: ` : '';
};

/** The learner's work in their terms, never the key. */
export function describePercentWork(ch: PercentBarChallenge, work: PercentWork): string {
  const step = challengeSteps(ch)[work.stepIndex];
  if (!step) return 'Nothing on the bar yet';
  if (step.kind === 'choice') {
    const chosen = step.options.find(o => o.id === work.selected);
    return `${stepLabel(ch, work.stepIndex)}${chosen ? `chose ${chosen.label}` : 'no option chosen yet'}`;
  }
  return `${stepLabel(ch, work.stepIndex)}the bar is set to ${work.percent}% of ${step.wholeValue}`;
}

/**
 * What a wrong step shows (`TeachingAttempt.miss`, handoff 20), from where the bar was set or the option tapped,
 * drawn from the catalog's commonStruggles (part and whole confused, the discount placed instead of what is left,
 * the added rate placed instead of the total, the bigger discount taken as the cheaper price):
 * - `complement` (identify): the rest of the whole, 100 minus the stated percent;
 * - `placed_discount` (a discount step): the discount itself, not what is still paid;
 * - `rate_not_total` (a total step): only the added rate; `whole_only`: 100%, the rate not added;
 *   `took_off_rate`: the rate taken off 100 instead of added;
 * - `placed_value`: the bar set to the part's value (dollars, points) read as a percent;
 * - `near_miss`: within 5 points of the step's percent, outside the tolerance;
 * - `too_high` / `too_low`: any other placement;
 * - `bigger_discount` (compare): the option with the bigger % off, which is not the asked one; `other_price`: the
 *   other option when the bigger discount was the right one.
 */
export type PercentBarMiss = 'complement' | 'placed_discount' | 'rate_not_total' | 'whole_only' | 'took_off_rate'
  | 'placed_value' | 'near_miss' | 'too_high' | 'too_low' | 'bigger_discount' | 'other_price';

const PLACEMENT: readonly PercentBarMiss[] = ['placed_value', 'near_miss', 'too_high', 'too_low'];
export const PERCENT_MISSES_BY_MODE: Record<string, readonly PercentBarMiss[]> = {
  identify_percent: ['complement', ...PLACEMENT],
  find_part: ['placed_discount', ...PLACEMENT],
  find_whole: ['rate_not_total', 'whole_only', 'took_off_rate', ...PLACEMENT],
  convert: ['placed_discount', ...PLACEMENT, 'bigger_discount', 'other_price'],
};

/** A place step that asks for a sale price as a percent of the original (a discount step). */
const isDiscountStep = (type: PercentBarChallengeType) => type === 'subtraction' || type === 'comparison';
/** On a tax/tip challenge, the total step (its percent is past the whole). */
const isTotalStep = (type: PercentBarChallengeType, step: PercentBarPlaceStep) => type === 'addition' && step.targetPercent > 100;

/** The discount on the comparison's place step for option `index` (its sale-price percent off 100). */
function optionDiscounts(ch: PercentBarChallenge): number[] {
  return challengeSteps(ch).filter((s): s is PercentBarPlaceStep => s.kind === 'place').map(s => 100 - s.targetPercent);
}

export function percentMiss(ch: PercentBarChallenge, work: PercentWork): PercentBarMiss | undefined {
  const step = challengeSteps(ch)[work.stepIndex];
  if (!step || stepCorrect(ch, work)) return undefined;
  if (step.kind === 'choice') {
    const discounts = optionDiscounts(ch), at = step.options.findIndex(o => o.id === work.selected);
    const other = at === 0 ? 1 : 0;
    return at >= 0 && (discounts[at] ?? 0) > (discounts[other] ?? 0) ? 'bigger_discount' : 'other_price';
  }
  const p = work.percent, t = step.targetPercent, near = (x: number) => withinTolerance(p, x);
  if (ch.type === 'direct' && near(100 - t)) return 'complement';
  if (isDiscountStep(ch.type) && near(100 - t)) return 'placed_discount';
  if (isTotalStep(ch.type, step)) {
    const rate = t - 100;
    if (near(rate)) return 'rate_not_total';
    if (near(100)) return 'whole_only';
    if (near(100 - rate)) return 'took_off_rate';
  }
  const value = (t / 100) * step.wholeValue;
  if (step.wholeValue !== 100 && near(value)) return 'placed_value';
  if (Math.abs(p - t) <= 5) return 'near_miss';
  return p > t ? 'too_high' : 'too_low';
}

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** What is drawn and asked. The step's percent and the right option are never named. */
export function workspaceScene(ch: PercentBarChallenge, view: PercentBarView): WorkspaceScene {
  const steps = challengeSteps(ch);
  const step = steps[view.stepIndex];
  const facts: Record<string, string> = {
    kind: ch.type,
    scenario: ch.scenario,
    ...(steps.length > 1 ? { step: `${view.stepIndex + 1} of ${steps.length}` } : {}),
    stepAsk: step?.prompt ?? ch.question,
  };
  if (step?.kind === 'place') {
    const max = step.maxPercent ?? 100;
    facts.whole = `${step.wholeValue} (${step.wholeValueLabel})`;
    facts.bar = `0% to ${max}%${max > 100 ? ', with a line at 100% marking the whole' : ''}`;
    facts.onBar = [
      // The guide lines are counted, not named: a named 25% beside a 75% discount answer reads as a key.
      view.showPercentLabels ? 'percent labels at the ends' : 'no percent labels',
      view.benchmarkLines.length ? `${view.benchmarkLines.length} guide line${view.benchmarkLines.length === 1 ? '' : 's'}` : 'no guide lines',
      view.showValueLabels ? 'a readout of the percent and the value it makes' : 'no value readout',
      view.showCalculation ? 'a calculation panel for where the bar is now' : 'no calculation panel',
      ...(view.doubleBar ? ['a second bar in the whole\'s units'] : []),
    ].join('; ');
  } else if (step?.kind === 'choice') {
    facts.options = step.options.map(o => (o.sublabel ? `${o.label} (${o.sublabel})` : o.label)).join(', ');
  }
  if (view.established.length) {
    facts.foundSoFar = view.established.map(e => `${e.label} ${e.percent}% = ${money(e.value)}`).join('; ');
  }
  facts.learnerWork = describePercentWork(ch, view);
  facts.constraints = 'The learner sets the bar by tapping or dragging it (or with the arrow keys) and presses Check; on a '
    + 'choice step they tap one option and press Check. The activity checks each step itself: a right step opens the '
    + 'next step of the same problem, and only the last step finishes it. You cannot move the bar, choose, or press Check.';
  return { objects: [], facts };
}

/**
 * The journey row's inputs for the current step on (`liveJourneySpec.ts`): each step's percent, or the right option.
 * `wrong`: the step's signature miss (the discount placed, the rate not added, the other option), else ten points off.
 */
export function percentHarnessSteps(ch: PercentBarChallenge, from: number, intent: 'correct' | 'wrong'):
  Array<{ kind: 'place'; percent: number } | { kind: 'choice'; label: string }> {
  const steps = challengeSteps(ch);
  const label = (s: Extract<PercentBarStep, { kind: 'choice' }>, id: string) => {
    const o = s.options.find(x => x.id === id)!;
    return o.sublabel ? `${o.label} ${o.sublabel}` : o.label;
  };
  if (intent === 'correct') return steps.slice(from).map(s => s.kind === 'place'
    ? { kind: 'place' as const, percent: s.targetPercent } : { kind: 'choice' as const, label: label(s, s.correctOptionId) });
  const s = steps[from];
  if (!s) return [];
  if (s.kind === 'choice') return [{ kind: 'choice', label: label(s, s.options.find(o => o.id !== s.correctOptionId)!.id) }];
  const t = s.targetPercent, max = s.maxPercent ?? 100;
  const signature = ch.type === 'addition' && t > 100 ? t - 100 : isDiscountStep(ch.type) || ch.type === 'direct' ? 100 - t : null;
  const pick = signature !== null && !withinTolerance(signature, t) ? signature : t + 10 <= max ? t + 10 : t - 10;
  return [{ kind: 'place', percent: pick }];
}
