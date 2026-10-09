/**
 * Distribution explorer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C19).
 *
 * Pure: the component, the journey row and any probe read the same choices, check, assignment and scene. Every mode
 * is a gesture item answered on the screen: identify, compute and predict-shape items are a tap on one choice and
 * Check; an explore item is checked by whether the learner moved a slider or changed the family before "Got it". The
 * tutor is never handed `correctFamily`, `correctValue`, `acceptableAnswers` or the rationale.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../components/live-activity/runtime/useTeachingWorkspace';
import { FAMILIES } from '../../lib/probability';
import type { DistributionChallenge, DistributionEvalMode, DistributionFamily } from './types';

/** One answer button: `key` is what the check reads, `label` is the button's text (and its aria-label). */
export interface DistributionChoice { key: string; label: string }

/** A stable shuffle keyed off the challenge id, so the order never changes between renders or paths. */
function seededShuffle<T>(id: string, all: readonly T[]): T[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) | 0;
  const a = [...all];
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Probabilities and rates under 1 show 4 decimals, larger values 2; trailing zeros are dropped. */
export function formatValue(value: number, decimals?: number): string {
  const fixed = value.toFixed(decimals ?? (Math.abs(value) < 1 ? 4 : 2));
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') || '0' : fixed;
}

const familyLabel = (f: DistributionFamily) => FAMILIES[f]?.label ?? f;

/** The choices as the screen shows them, in screen order. A guided exploration has none. */
export function distributionChoices(ch: DistributionChallenge): DistributionChoice[] {
  switch (ch.type) {
    case 'identify':
      return seededShuffle(ch.id, [ch.correctFamily, ...ch.distractors]).map(f => ({ key: f, label: familyLabel(f) }));
    case 'compute':
      return seededShuffle(ch.id, [ch.correctValue, ...ch.distractors]).map(v => {
        const shown = formatValue(v, ch.decimals);
        return { key: String(v), label: ch.unit ? `${shown} ${ch.unit}` : shown };
      });
    case 'predict_shape':
      return seededShuffle(ch.id, [ch.acceptableAnswers[0], ...ch.distractors]).map(s => ({ key: s, label: s }));
    default:
      return [];
  }
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** The learner's work: the choice picked (its `key`), and on explore whether the workbench was moved since the item opened. */
export interface DistributionWork {
  picked: string | null;
  explored: boolean;
  /** The family and parameters the workbench shows now (explore's scene and learner work). */
  family: DistributionFamily;
  params: Readonly<Record<string, number>>;
}

/** The activity's own check. Nothing picked is not a check (the Check button is disabled). */
export function distributionCorrect(ch: DistributionChallenge, work: DistributionWork): boolean {
  switch (ch.type) {
    case 'guided_exploration': return work.explored;
    case 'identify': return work.picked === ch.correctFamily;
    case 'compute': return work.picked !== null && Number(work.picked) === ch.correctValue;
    case 'predict_shape': return work.picked !== null && ch.acceptableAnswers.map(normalize).includes(normalize(work.picked));
  }
}

/** The sliders as the screen prints them, e.g. "λ (rate) = 4". */
export function sliderText(family: DistributionFamily, params: Readonly<Record<string, number>>): string {
  return FAMILIES[family].parameters
    .map(p => `${p.label} = ${p.integer ? String(params[p.name] ?? p.defaultValue) : Number((params[p.name] ?? p.defaultValue).toFixed(2))}`)
    .join('; ');
}

/** The learner's work in words, never the key. */
export function describeDistributionWork(ch: DistributionChallenge, work: DistributionWork): string {
  if (ch.type === 'guided_exploration') {
    return `${work.explored ? 'moved the workbench since this prompt opened' : 'has not moved a slider or changed the family since this prompt opened'}; `
      + `it shows ${familyLabel(work.family)} with ${sliderText(work.family, work.params)}`;
  }
  const choice = distributionChoices(ch).find(c => c.key === work.picked);
  return choice ? `picked "${choice.label}"` : 'nothing picked yet';
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the choice picked, drawn from the catalog's
 * commonStruggles (rate vs mean, discrete vs continuous, complements and boundary terms, skew direction):
 * - explore: `not_explored` (Got it with no slider moved and no family changed);
 * - identify: `discrete_continuous` (a family of the other kind: exponential for a count, or a count for a waiting
 *   time), `binomial_poisson` (the two counting families swapped);
 * - compute: `complement` (1 − the answer), `reciprocal` (1 ÷ the answer: the rate for the mean), `near_value` (within
 *   15%: a boundary term in or out, ≤ for <), `wrong_value`;
 * - predict shape: `reversed_skew` (left for right or right for left), `said_symmetric`, `wrong_shape`.
 */
export type DistributionMiss = 'not_explored' | 'discrete_continuous' | 'binomial_poisson'
  | 'complement' | 'reciprocal' | 'near_value' | 'wrong_value'
  | 'reversed_skew' | 'said_symmetric' | 'wrong_shape';

const COMPUTE_MISSES: readonly DistributionMiss[] = ['complement', 'reciprocal', 'near_value', 'wrong_value'];
export const DISTRIBUTION_MISSES_BY_MODE: Record<DistributionEvalMode, readonly DistributionMiss[]> = {
  explore: ['not_explored'],
  identify: ['discrete_continuous', 'binomial_poisson'],
  compute_basic: COMPUTE_MISSES,
  compute_advanced: [...COMPUTE_MISSES, 'reversed_skew', 'said_symmetric', 'wrong_shape'],
};

const close = (a: number, b: number, rel: number) => Math.abs(a - b) <= Math.max(1e-4, rel * Math.abs(b));

/** A wrong numeric pick, read against the key. */
export function computeMiss(picked: number, key: number): DistributionMiss {
  if (key > 0 && key < 1 && close(picked, 1 - key, 0.01)) return 'complement';
  if (key !== 0 && close(picked, 1 / key, 0.01)) return 'reciprocal';
  if (close(picked, key, 0.15)) return 'near_value';
  return 'wrong_value';
}

const skewOf = (s: string): 'right' | 'left' | null => {
  const t = normalize(s);
  if (/\bright\b|\bpositive(ly)?\b/.test(t)) return 'right';
  if (/\bleft\b|\bnegative(ly)?\b/.test(t)) return 'left';
  return null;
};

export function distributionMiss(ch: DistributionChallenge | null, work: DistributionWork): DistributionMiss | undefined {
  if (!ch || distributionCorrect(ch, work)) return undefined;
  switch (ch.type) {
    case 'guided_exploration': return 'not_explored';
    case 'identify': {
      if (!work.picked) return undefined;
      const kind = (f: string) => FAMILIES[f as DistributionFamily]?.kind;
      return kind(work.picked) !== kind(ch.correctFamily) ? 'discrete_continuous' : 'binomial_poisson';
    }
    case 'compute':
      return work.picked === null ? undefined : computeMiss(Number(work.picked), ch.correctValue);
    case 'predict_shape': {
      if (!work.picked) return undefined;
      const mine = skewOf(work.picked), key = skewOf(ch.acceptableAnswers[0]);
      if (mine && key && mine !== key) return 'reversed_skew';
      if (/symmetric|bell|normal/.test(normalize(work.picked))) return 'said_symmetric';
      return 'wrong_shape';
    }
  }
}

export function workspaceAssignment(ch: DistributionChallenge): TeachingAssignment {
  const task = ch.type === 'guided_exploration'
    ? `${ch.prompt} Move the sliders or change the family, then press Got it.`
    : ch.scenario ? `${ch.scenario} ${ch.prompt}` : ch.prompt;
  return { id: ch.id, task, response: 'gesture' };
}

const KIND: Record<DistributionChallenge['type'], string> = {
  guided_exploration: 'guided exploration: try the experiment the prompt names on the workbench, then press Got it',
  identify: 'identify the distribution family from the description',
  compute: 'compute a probability or moment for the scenario and pick it from four values',
  predict_shape: 'describe the shape of the distribution, picked from a list',
};

/** What is drawn and asked. The key is never named; on identify the workbench hides its family until the check. */
export function workspaceScene(ch: DistributionChallenge, work: DistributionWork, familyHidden: boolean,
  valuesHidden = false): WorkspaceScene {
  const facts: Record<string, string> = { kind: KIND[ch.type] };
  if (ch.scenario) facts.scenario = ch.scenario;
  facts.question = ch.prompt;
  const choices = distributionChoices(ch);
  if (choices.length) facts.choices = choices.map(c => c.label).join(' | ');
  facts.workbench = familyHidden
    ? 'a distribution chart with its family name, formula, description and sliders hidden until the family is checked'
    : `${familyLabel(work.family)} (${FAMILIES[work.family].kind}); sliders: ${sliderText(work.family, work.params)}; `
      + (valuesHidden
        ? 'the chart (PMF/PDF or CDF) redraws as the sliders move; its value readout and the mean and variance panel are hidden until this item is checked'
        : 'the chart (PMF/PDF or CDF) and the mean, variance, standard deviation and skewness update as the sliders move');
  facts.learnerWork = describeDistributionWork(ch, work);
  facts.constraints = ch.type === 'guided_exploration'
    ? 'The learner moves the parameter sliders or changes the family, then presses Got it; the activity credits Got it '
      + 'only after the workbench was moved on this prompt. There is no right answer to the question; their observation is spoken to you. '
      + 'You cannot move a slider, change the family or press Got it.'
    : 'The learner taps one choice and presses Check; the activity checks it itself. The learner may also use the '
      + 'workbench sliders to test an idea. You cannot tap a choice, move a slider or press Check.';
  return { objects: [], facts };
}

/**
 * The journey row's input (`liveJourneySpec.ts`). Choices: `correct` the key's label; `wrong` the first other choice in
 * screen order. Explore: `correct` a new value for the first slider (its maximum, or its minimum when it is there);
 * `wrong` nothing (Got it alone).
 */
export function distributionHarnessSlider(workbench: string): { label: string; text: string } | null {
  const m = /sliders: (.+?) = (-?[\d.]+)/.exec(workbench);
  if (!m) return null;
  const schema = Object.values(FAMILIES).flatMap(f => f.parameters).find(p => p.label === m[1]);
  if (!schema) return null;
  return { label: schema.label, text: String(Number(m[2]) === schema.max ? schema.min : schema.max) };
}

export function distributionHarnessChoice(ch: DistributionChallenge, intent: 'correct' | 'wrong'): string | null {
  const choices = distributionChoices(ch);
  const isKey = (c: DistributionChoice) => distributionCorrect(ch, { picked: c.key, explored: false, family: 'binomial', params: {} });
  return (intent === 'correct' ? choices.find(isKey) : choices.find(c => !isKey(c)))?.label ?? null;
}
