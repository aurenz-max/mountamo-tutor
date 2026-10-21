/**
 * Percent bar on the shared tutor/JEV teaching workspace: its domain for the boss (`percentBar.boss.ts`).
 *
 * Pure: the component, the boss and any probe read the same ask, check and scene. A challenge is one or more steps, each
 * answered on the screen (the bar set to a percent, or one option tapped) and checked by the activity's own Check.
 * A right step opens the next step of the same challenge and is not a commit; a wrong step, and the last step
 * right, are. The tutor is never handed a step's target percent or which option is right.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type {
  PercentBarAmountStep, PercentBarChallenge, PercentBarChallengeType, PercentBarPlaceStep, PercentBarStep,
} from './PercentBar';
import { percentMissValues } from '../../../service/itemSpace/percentOf';
import type { AmountMiss, PercentBarMiss } from './percentBar.card';

export { PERCENT_MISSES_BY_MODE, type AmountMiss, type PercentBarMiss } from './percentBar.card';

/** ±2 percentage points, the activity's tolerance since birth. */
export const PERCENT_TOLERANCE = 2;

/** find_part and find_whole: the learner produces an amount, so no readout, panel or tick label may show one. */
export const amountsHidden = (type: PercentBarChallengeType) => type === 'part_of' || type === 'whole_of';

/** The amount an amount step asks for: the part, or the whole. */
export const amountTarget = (s: PercentBarAmountStep) => (s.unknown === 'part' ? s.part : s.whole);

/** A typed amount as a number, or null when nothing readable is typed. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

/** The step list: a single-step challenge synthesises one place step from its own fields. */
export function challengeSteps(ch: PercentBarChallenge): PercentBarStep[] {
  if (ch.steps && ch.steps.length > 0) return ch.steps;
  return [{
    kind: 'place', prompt: ch.question, wholeValue: ch.wholeValue, wholeValueLabel: ch.wholeValueLabel,
    targetPercent: ch.targetPercent, maxPercent: ch.maxPercent, hint: ch.hint,
  }];
}

/** What the learner is asked: the scenario and every step's question. */
export function percentAsk(ch: PercentBarChallenge): string {
  const steps = challengeSteps(ch);
  return steps.length > 1
    ? `${ch.scenario} Work it in ${steps.length} steps, pressing Check after each: ${steps.map(s => s.prompt).join(' ')}`
    : `${ch.scenario} ${steps[0]?.prompt ?? ch.question}`;
}

/** The learner's work on the current step. */
export interface PercentWork {
  stepIndex: number;
  /** Where the bar is set now, in percent. */
  percent: number;
  /** The option id tapped on a choice step. */
  selected: string | null;
  /** What is typed on an amount step. */
  amount?: string;
}

export interface PercentBarView extends PercentWork {
  /** Steps already checked right on this challenge, as the recap card shows them (no value on a find-part or
   *  find-whole item, whose amount is the next step's answer). */
  established: readonly { label: string; percent: number; value: number | null }[];
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
  if (step.kind === 'amount') {
    const typed = parseAmount(work.amount ?? '');
    return typed !== null && Math.abs(typed - amountTarget(step)) < 0.005;
  }
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
  if (step.kind === 'amount') {
    const typed = (work.amount ?? '').trim();
    return `${stepLabel(ch, work.stepIndex)}${typed ? `typed ${typed}` : 'nothing typed yet'}`;
  }
  // The whole of a find-whole item is its answer: the work names the percent only.
  return `${stepLabel(ch, work.stepIndex)}the bar is set to ${work.percent}%${step.wholeUnknown ? '' : ` of ${step.wholeValue}`}`;
}

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
  if (step.kind === 'amount') {
    const typed = parseAmount(work.amount ?? '');
    if (typed === null) return 'too_low';
    const named = Object.entries(percentMissValues(step)).find(([, v]) => Math.abs(v - typed) < 0.005);
    if (named) return named[0] as AmountMiss;
    const t = amountTarget(step);
    if (Math.abs(typed - t) <= Math.max(1, t / 10)) return 'near_miss';
    return typed > t ? 'too_high' : 'too_low';
  }
  const p = work.percent, t = step.targetPercent, near = (x: number) => withinTolerance(p, x);
  if ((ch.type === 'direct' || amountsHidden(ch.type)) && near(100 - t)) return 'complement';
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
export function workspaceScene(ch: PercentBarChallenge, view: PercentBarView): SceneOf {
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
    facts.whole = step.wholeUnknown ? `not given: the whole (${step.wholeValueLabel}) is what the learner finds`
      : `${step.wholeValue} (${step.wholeValueLabel})`;
    if (step.knownPart !== undefined) facts.knownPart = `${money(step.knownPart)}, written at the end of the filled part`;
    facts.bar = `0% to ${max}%${max > 100 ? ', with a line at 100% marking the whole' : ''}`;
    facts.onBar = [
      // The guide lines are counted, not named: a named 25% beside a 75% discount answer reads as a key.
      view.showPercentLabels ? 'percent labels at the ends' : 'no percent labels',
      view.benchmarkLines.length ? `${view.benchmarkLines.length} guide line${view.benchmarkLines.length === 1 ? '' : 's'}` : 'no guide lines',
      view.showValueLabels ? 'a readout of the percent and the value it makes' : 'no value readout',
      view.showCalculation ? 'a calculation panel for where the bar is now' : 'no calculation panel',
      ...(view.doubleBar ? ['a second bar in the whole\'s units'] : []),
    ].join('; ');
  } else if (step?.kind === 'amount') {
    facts.bar = `filled to ${step.percent}%, the percent marked on the step before`;
    facts.whole = step.unknown === 'whole' ? `not given: it is the amount the learner types (${step.wholeValueLabel})`
      : `${money(step.whole)} (${step.wholeValueLabel}), written at the end of the bar`;
    facts.part = step.unknown === 'part' ? 'not given: it is the amount the learner types, marked ? at the end of the filled part'
      : `${money(step.part)}, written at the end of the filled part`;
    facts.onBar = view.benchmarkLines.length
      ? `${view.benchmarkLines.length} guide line${view.benchmarkLines.length === 1 ? '' : 's'}` : 'no guide lines';
  } else if (step?.kind === 'choice') {
    facts.options = step.options.map(o => (o.sublabel ? `${o.label} (${o.sublabel})` : o.label)).join(', ');
  }
  if (view.established.length) {
    facts.foundSoFar = view.established.map(e => `${e.label} ${e.percent}%${e.value === null ? '' : ` = ${money(e.value)}`}`).join('; ');
  }
  facts.learnerWork = describePercentWork(ch, view);
  // The moves are the card's; what is this primitive's own is that a right step is not the end of the problem.
  facts.constraints = 'A right step opens the next step of the same problem, and only the last step finishes it.';
  return { objects: [], facts };
}

/**
 * The journey row's inputs for the current step on (`percentBar.boss.ts` drive.play): each step's percent, or the right option.
 * `wrong`: the step's signature miss (the discount placed, the rate not added, the other option), else ten points off.
 */
export function percentHarnessSteps(ch: PercentBarChallenge, from: number, intent: 'correct' | 'wrong'):
  Array<{ kind: 'place'; percent: number } | { kind: 'choice'; label: string } | { kind: 'amount'; amount: string }> {
  const steps = challengeSteps(ch);
  const label = (s: Extract<PercentBarStep, { kind: 'choice' }>, id: string) => {
    const o = s.options.find(x => x.id === id)!;
    return o.sublabel ? `${o.label} ${o.sublabel}` : o.label;
  };
  if (intent === 'correct') return steps.slice(from).map(s => s.kind === 'place'
    ? { kind: 'place' as const, percent: s.targetPercent }
    : s.kind === 'amount' ? { kind: 'amount' as const, amount: String(amountTarget(s)) }
      : { kind: 'choice' as const, label: label(s, s.correctOptionId) });
  const s = steps[from];
  if (!s) return [];
  if (s.kind === 'amount') {
    const [signature] = Object.values(percentMissValues(s));
    return [{ kind: 'amount', amount: String(signature ?? amountTarget(s) + 10) }];
  }
  if (s.kind === 'choice') return [{ kind: 'choice', label: label(s, s.options.find(o => o.id !== s.correctOptionId)!.id) }];
  const t = s.targetPercent, max = s.maxPercent ?? 100;
  const signature = ch.type === 'addition' && t > 100 ? t - 100
    : isDiscountStep(ch.type) || ch.type === 'direct' || amountsHidden(ch.type) ? 100 - t : null;
  const pick = signature !== null && !withinTolerance(signature, t) ? signature : t + 10 <= max ? t + 10 : t - 10;
  return [{ kind: 'place', percent: pick }];
}
