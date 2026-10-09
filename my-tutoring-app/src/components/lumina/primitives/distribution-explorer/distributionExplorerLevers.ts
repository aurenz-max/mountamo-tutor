/**
 * The in-item levers on a distribution-explorer item (`/add-support-tiers`; report
 * qa/eval-reports/distribution-explorer-levers-2026-10-09.md). No real-learner evidence: the misses are what
 * `distributionMiss` observes and the catalog's commonStruggles. Pure: the component draws from these, the workspace
 * publishes them, the tests hold each leak rule. Every easier item has the id `<item>~simpler` and the item's type.
 *
 * - explore: `slider_glow` (help) rings the sliders the prompt names (all of them when it names none). Nothing is said
 *   about what the chart will do.
 * - identify: the family IS the answer, so no lever marks a choice: `family_facts` (help) puts the same kind of fact
 *   under every choice (what it models, which values it can take); `two_families` (simplify) asks a different, plainer
 *   scenario with two choices, never the item's family as the asked one.
 * - compute: `event_strip` (help) lists which counts the asked event takes and which it leaves out (no probability);
 *   `worked_model` (help) works the same question through on a model outside the item (other parameter values) to its
 *   number; `simpler_compute` (simplify) asks one step less on the model (a single P(X = k), or the mean of a waiting time).
 * - predict shape: `shape_guide` (help) a card naming the three shape words by what their tails do; `two_shapes`
 *   (simplify) asks the shape of a stated model with two choices, its answer not the item's.
 */
import type { WorkspaceLever } from '../../components/live-activity/runtime/contract';
import { FAMILIES } from '../../lib/probability';
import { distributionChoices, formatValue, type DistributionMiss } from './distributionExplorerWorkspace';
import type {
  ComputeChallenge, DistributionChallenge, DistributionFamily, IdentifyChallenge, PredictShapeChallenge,
} from './types';

export const SLIDER_GLOW_LEVER = 'slider_glow';
export const FAMILY_FACTS_LEVER = 'family_facts';
export const TWO_FAMILIES_LEVER = 'two_families';
export const EVENT_STRIP_LEVER = 'event_strip';
export const WORKED_MODEL_LEVER = 'worked_model';
export const SIMPLER_COMPUTE_LEVER = 'simpler_compute';
export const SHAPE_GUIDE_LEVER = 'shape_guide';
export const TWO_SHAPES_LEVER = 'two_shapes';

export const PRACTICE_SUFFIX = '~simpler';
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');
export const isPractice = (c: Pick<DistributionChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);

// ── explore: which sliders the prompt names ────────────────────────────────

/** The parameter names (`n`, `p`, `lambda`) a prompt mentions; empty when it names none. */
export function namedSliders(prompt: string): string[] {
  const t = ` ${prompt} `;
  const out: string[] = [];
  if (/[^A-Za-z]n[^A-Za-z]|trials/.test(t)) out.push('n');
  if (/[^A-Za-z]p[^A-Za-z]|success probability/.test(t)) out.push('p');
  if (/λ|lambda|\brate\b/i.test(t)) out.push('lambda');
  return out;
}

// ── identify: the same fact under every choice ─────────────────────────────

/** One fact per family, in the same terms for each; none names another family. */
export const FAMILY_FACTS: Record<DistributionFamily, string> = {
  binomial: 'counts successes in a fixed number of tries; values 0 up to the number of tries',
  poisson: 'counts events in an interval at a steady rate; values 0, 1, 2, … with no top',
  exponential: 'a waiting time until the next event; any value from 0 up, not only whole numbers',
};

/** Leak rule: a fact names no family, and every fact has the same parts (what it models; its values). */
export function familyFactsLeak(): boolean {
  const names = Object.values(FAMILIES).map(f => f.label.toLowerCase());
  return Object.values(FAMILY_FACTS).some(f => names.some(n => f.toLowerCase().includes(n)) || f.split('; ').length !== 2);
}

const SCENARIO_BANK: Record<DistributionFamily, string> = {
  binomial: 'A student guesses on every one of 12 true-or-false questions. Which family models how many they get right?',
  poisson: 'A help desk gets about 6 emails an hour, at random. Which family models the number of emails in one hour?',
  exponential: 'Buses come at random, about 4 an hour. Which family models the wait until the next bus?',
};

/** Leak rule for an easier identify: never the item, never the item's family as the asked one, two choices. */
export function twoFamiliesLeaks(p: IdentifyChallenge, c: IdentifyChallenge): boolean {
  return p.id === c.id || p.correctFamily === c.correctFamily || p.prompt === c.prompt || p.distractors.length !== 1;
}

export function twoFamilies(c: DistributionChallenge): IdentifyChallenge | null {
  if (c.type !== 'identify' || isPractice(c)) return null;
  const target: DistributionFamily = c.correctFamily === 'exponential' ? 'binomial' : 'exponential';
  // The foil is of the other kind from the asked family, so the two are far apart.
  const foil: DistributionFamily = target === 'exponential' ? (c.correctFamily === 'binomial' ? 'poisson' : 'binomial') : 'exponential';
  const p: IdentifyChallenge = { id: `${c.id}${PRACTICE_SUFFIX}`, type: 'identify', prompt: SCENARIO_BANK[target],
    rationale: `This is ${FAMILIES[target].label}: it ${FAMILY_FACTS[target].split('; ')[0]}.`, correctFamily: target, distractors: [foil] };
  return twoFamiliesLeaks(p, c) ? null : p;
}

// ── compute: what is asked, read from the item's words ─────────────────────

export type AskedKind = 'mean' | 'variance' | 'point' | 'at_least' | 'more_than' | 'at_most' | 'less_than';
export interface Asked { family: DistributionFamily; params: Record<string, number>; kind: AskedKind; k: number }

const num = (s: string | undefined) => (s === undefined ? NaN : Number(s));

/** The family, its parameters and the asked quantity, from the scenario and prompt; null when the words do not say. */
export function askedOf(c: DistributionChallenge): Asked | null {
  if (c.type !== 'compute') return null;
  const text = `${c.scenario ?? ''} ${c.prompt}`;
  const lower = text.toLowerCase();
  const family: DistributionFamily | null = /binomial|bin\(/.test(lower) ? 'binomial' : /poisson/.test(lower) ? 'poisson'
    : /exponential|exp\(/.test(lower) ? 'exponential'
    // "Claims arrive at λ = 3/day. P(no claims tomorrow)?" (the generator's own example): a rate and a count asked.
    : /λ|lambda/.test(lower) && !/wait|lifetime|surviv|time until|time between/.test(lower) ? 'poisson' : null;
  if (!family) return null;
  let params: Record<string, number> | null = null;
  if (family === 'binomial') {
    const m = /binomial\s*\(\s*(\d+)\s*,\s*([\d.]+)\s*\)/i.exec(text);
    const n = m ? num(m[1]) : num(/\bn\s*=\s*(\d+)/.exec(text)?.[1]);
    const p = m ? num(m[2]) : num(/\bp\s*=\s*([\d.]+)/.exec(text)?.[1]);
    if (Number.isInteger(n) && n > 0 && p > 0 && p < 1) params = { n, p };
  } else {
    const l = num(/(?:λ|lambda)\s*=?\s*([\d.]+)/i.exec(text)?.[1] ?? /poisson\s*\(\s*([\d.]+)/i.exec(text)?.[1]
      ?? /rate\s*(?:of\s*)?([\d.]+)/i.exec(text)?.[1]
      ?? /exp\s*\(\s*(?:rate\s*)?([\d.]+)/i.exec(text)?.[1]);
    if (l > 0) params = { lambda: l };
  }
  if (!params) return null;
  // The asked quantity: from the prompt first (the scenario may say "expected rate").
  const ask = c.prompt.toLowerCase();
  const k = (re: RegExp) => { const m = re.exec(ask); return m ? num(m.slice(1).find(x => x !== undefined)) : NaN; };
  const probability = /probab|p\s*\(/.test(ask);
  if (!probability && /variance|var\s*\[/.test(ask)) return { family, params, kind: 'variance', k: 0 };
  if (!probability && /expected|e\s*\[|mean/.test(ask)) return { family, params, kind: 'mean', k: 0 };
  const tries: Array<[AskedKind, RegExp]> = [
    ['at_least', /at least ([\d.]+)|≥\s*([\d.]+)|>=\s*([\d.]+)/],
    ['at_most', /at most ([\d.]+)|no more than ([\d.]+)|≤\s*([\d.]+)|<=\s*([\d.]+)|within ([\d.]+)/],
    ['more_than', /more than ([\d.]+)|longer than ([\d.]+)|exceeds? ([\d.]+)|>\s*([\d.]+)/],
    ['less_than', /fewer than ([\d.]+)|less than ([\d.]+)|<\s*([\d.]+)/],
    ['point', /exactly ([\d.]+)|x\s*=\s*([\d.]+)/],
  ];
  for (const [kind, re] of tries) {
    const v = k(re);
    if (Number.isFinite(v)) return family === 'exponential' && kind === 'point' ? null : { family, params, kind, k: v };
  }
  if (family !== 'exponential' && /exactly zero|\bno (?:claims|events|calls|failures|arrivals|defects|errors)\b|\bzero\b/.test(ask)) {
    return { family, params, kind: 'point', k: 0 };
  }
  return null;
}

// ── compute: the numbers, closed form ──────────────────────────────────────

function lnFact(n: number): number { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
function pmf(a: Pick<Asked, 'family' | 'params'>, x: number): number {
  if (a.family === 'poisson') { const l = a.params.lambda; return Math.exp(x * Math.log(l) - l - lnFact(x)); }
  const { n, p } = a.params;
  if (x < 0 || x > n) return 0;
  return Math.exp(lnFact(n) - lnFact(x) - lnFact(n - x) + x * Math.log(p) + (n - x) * Math.log(1 - p));
}
const cdf = (a: Pick<Asked, 'family' | 'params'>, x: number) => {
  let s = 0; for (let i = 0; i <= Math.floor(x); i++) s += pmf(a, i); return s;
};

/** The value the asked quantity takes for this family and these parameters. */
export function valueOf(a: Asked): number {
  const { family: f, params: q, kind, k } = a;
  if (kind === 'mean') return f === 'binomial' ? q.n * q.p : f === 'poisson' ? q.lambda : 1 / q.lambda;
  if (kind === 'variance') return f === 'binomial' ? q.n * q.p * (1 - q.p) : f === 'poisson' ? q.lambda : 1 / (q.lambda * q.lambda);
  if (f === 'exponential') {
    const survive = Math.exp(-q.lambda * k);
    return kind === 'more_than' || kind === 'at_least' ? survive : 1 - survive;
  }
  switch (kind) {
    case 'point': return pmf(a, k);
    case 'at_most': return cdf(a, k);
    case 'less_than': return cdf(a, k - 1);
    case 'at_least': return 1 - cdf(a, k - 1);
    default: return 1 - cdf(a, k);
  }
}

const r4 = (n: number) => Number(n.toFixed(4));
const symbol = (f: DistributionFamily) => (f === 'exponential' ? 'T' : 'X');
const describeModel = (f: DistributionFamily, q: Record<string, number>) =>
  f === 'binomial' ? `X ~ Binomial(n = ${q.n}, p = ${q.p})` : f === 'poisson' ? `X ~ Poisson(λ = ${q.lambda})` : `T ~ Exponential(rate ${q.lambda})`;

/** Other parameter values of the same family, for a model outside the item. */
function modelParams(a: Asked, step = 1): Record<string, number> {
  const q = a.params;
  if (a.family === 'binomial') return { n: q.n + 4 * step, p: Number(Math.min(0.9, Math.max(0.1, q.p >= 0.5 ? q.p - 0.1 * step : q.p + 0.1 * step)).toFixed(2)) };
  if (a.family === 'poisson') return { lambda: q.lambda >= 6 ? q.lambda - 2 * step : q.lambda + 2 * step };
  // Up by 0.3 a step, never to a rate of 1 (its mean, rate and squares would all print as 1).
  const l = Number((q.lambda + 0.3 * step).toFixed(2));
  return { lambda: l === 1 ? 1.15 : l };
}

const EVENT_WORDS: Record<AskedKind, string> = {
  mean: 'the mean', variance: 'the variance', point: '=', at_least: '≥', more_than: '>', at_most: '≤', less_than: '<',
};

/** The worked steps for `a`, ending at its number. */
export function workSteps(a: Asked): string[] {
  const X = symbol(a.family), q = a.params, v = valueOf(a), k = a.k;
  const head = describeModel(a.family, q);
  const P = (x: number) => `P(${x})`;
  const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  if (a.kind === 'mean') {
    const how = a.family === 'binomial' ? `n × p = ${q.n} × ${q.p}` : a.family === 'poisson' ? 'λ' : `1 ÷ rate = 1 ÷ ${q.lambda}`;
    return [head, `E[${X}] = ${how} = ${formatValue(v)}`];
  }
  if (a.kind === 'variance') {
    const how = a.family === 'binomial' ? `n × p × (1 − p) = ${q.n} × ${q.p} × ${r4(1 - q.p)}` : a.family === 'poisson' ? 'λ' : `1 ÷ rate² = 1 ÷ ${q.lambda}²`;
    return [head, `Var[${X}] = ${how} = ${formatValue(v)}`];
  }
  if (a.family === 'exponential') {
    const s = `e^(−${q.lambda} × ${k})`;
    return [head, a.kind === 'more_than' || a.kind === 'at_least' ? `P(T ${EVENT_WORDS[a.kind]} ${k}) = ${s} = ${formatValue(v)}`
      : `P(T ${EVENT_WORDS[a.kind]} ${k}) = 1 − ${s} = ${formatValue(v)}`];
  }
  const parts = (xs: number[]) => xs.map(x => `${formatValue(r4(pmf(a, x)))}`).join(' + ');
  const term = a.family === 'poisson' ? `P(x) = λ^x e^(−λ) ÷ x!` : `P(x) = C(n, x) p^x (1 − p)^(n − x)`;
  switch (a.kind) {
    case 'point': return [head, term, `P(X = ${k}) = ${formatValue(v)}`];
    case 'at_most': case 'less_than': {
      const top = a.kind === 'at_most' ? k : k - 1;
      return [head, term, `P(X ${EVENT_WORDS[a.kind]} ${k}) = ${range(0, top).map(P).join(' + ')} = ${parts(range(0, top))} = ${formatValue(v)}`];
    }
    default: {
      const top = a.kind === 'at_least' ? k - 1 : k;
      return [head, term, `P(X ${EVENT_WORDS[a.kind]} ${k}) = 1 − [${range(0, top).map(P).join(' + ')}] = 1 − (${parts(range(0, top))}) = ${formatValue(v)}`];
    }
  }
}

/** Whether `text` prints the number `n` (as written), not as part of a longer number. */
export const printsNumber = (text: string, n: string) =>
  new RegExp(`(^|[^\\d.])${n.replace(/[.\-]/g, m => `\\${m}`)}(?![\\d]|\\.\\d)`).test(text);

/** Leak rule for a worked model: other parameters than the item's, and no number in it that is a choice on screen. */
export function workedModelLeaks(model: Asked, c: ComputeChallenge, steps: readonly string[]): boolean {
  const item = askedOf(c);
  if (!item || JSON.stringify(model.params) === JSON.stringify(item.params)) return true;
  const own = `${c.scenario ?? ''} ${c.prompt}`;
  // A number the item's own words already print (its k, its rate) is not given away by the model.
  const labels = distributionChoices(c).map(ch => ch.key).filter(l => !printsNumber(own, l));
  const text = steps.join(' ');
  return labels.some(l => printsNumber(text, l))
    || Math.abs(valueOf(model) - c.correctValue) <= Math.max(1e-4, 0.01 * Math.abs(c.correctValue));
}

/** The worked model for a compute item: the same question on other parameter values; null when none is safe. */
export function workedModel(c: DistributionChallenge): { asked: Asked; steps: string[] } | null {
  if (c.type !== 'compute' || isPractice(c)) return null;
  const item = askedOf(c);
  if (!item) return null;
  for (let step = 1; step <= 3; step++) {
    const asked: Asked = { ...item, params: modelParams(item, step) };
    const steps = workSteps(asked);
    if (!workedModelLeaks(asked, c, steps)) return { asked, steps };
  }
  return null;
}

/** The counts the asked event takes, and the ones it leaves out, for a whole-number event; null otherwise. */
export function eventStrip(c: DistributionChallenge): { inEvent: number[]; outside: number[]; open: boolean } | null {
  const a = askedOf(c);
  if (!a || a.family === 'exponential' || a.kind === 'mean' || a.kind === 'variance' || !Number.isInteger(a.k)) return null;
  const top = Math.min(a.family === 'binomial' ? a.params.n : Infinity, a.k + 3);
  const all = Array.from({ length: top + 1 }, (_, i) => i);
  const has = (x: number) => a.kind === 'point' ? x === a.k : a.kind === 'at_least' ? x >= a.k : a.kind === 'more_than' ? x > a.k
    : a.kind === 'at_most' ? x <= a.k : x < a.k;
  if (a.kind === 'point') return null; // one count: the strip would only repeat the question
  return { inEvent: all.filter(has), outside: all.filter(x => !has(x)), open: a.family === 'poisson' || top < a.params.n };
}

/** "Asked: 3, 4, 5, 6, … | Left out: 0, 1, 2": the list holding the top count runs on when the counts have no top. */
export function stripText(s: NonNullable<ReturnType<typeof eventStrip>>): string {
  const top = Math.max(...s.inEvent, ...s.outside);
  const list = (xs: number[]) => `${xs.join(', ')}${s.open && xs.includes(top) ? ', …' : ''}`;
  return `Asked: ${list(s.inEvent)} | Left out: ${list(s.outside)}`;
}

/** Leak rule for the strip: whole counts only, never a decimal (a probability) and never a choice on screen. */
export function stripLeaks(text: string, c: ComputeChallenge): boolean {
  return /\d\.\d/.test(text) || distributionChoices(c).some(ch => printsNumber(text, ch.key));
}

/** One step less on a model outside the item: a single P(X = k) (a mean for a waiting time). Null when the item is one step. */
export function simplerCompute(c: DistributionChallenge): ComputeChallenge | null {
  if (c.type !== 'compute' || isPractice(c)) return null;
  const item = askedOf(c);
  if (!item || item.kind === 'mean' || item.kind === 'variance' || item.kind === 'point') return null;
  for (let step = 1; step <= 3; step++) {
    const p = simplerOn(c, item, modelParams(item, step));
    if (p && !simplerLeaks(p, c)) return p;
  }
  return null;
}

function simplerOn(c: ComputeChallenge, item: Asked, params: Record<string, number>): ComputeChallenge | null {
  const asked: Asked = item.family === 'exponential' ? { ...item, params, kind: 'mean', k: 0 }
    : { ...item, params, kind: 'point', k: Math.max(0, Math.round(item.k) - (item.kind === 'less_than' ? 1 : 0)) };
  const key = r4(valueOf(asked));
  const wrongs = item.family === 'exponential' ? [params.lambda, r4(params.lambda * params.lambda), r4(1 / (params.lambda * params.lambda))]
    : [r4(1 - key), r4(cdf(asked, asked.k)), r4(pmf(asked, asked.k + 1))];
  const distractors = Array.from(new Set(wrongs.filter(w => formatValue(w) !== formatValue(key) && w > 0)));
  if (distractors.length < 2 || new Set([key, ...distractors].map(v => formatValue(v))).size !== distractors.length + 1) return null;
  const X = symbol(item.family);
  const prompt = asked.kind === 'mean' ? `Practice first. ${describeModel(item.family, params)}. Find E[${X}].`
    : `Practice first. ${describeModel(item.family, params)}. Find P(X = ${asked.k}).`;
  return { id: `${c.id}${PRACTICE_SUFFIX}`, type: 'compute', prompt, rationale: workSteps(asked).slice(1).join(' '),
    correctValue: key, distractors };
}

/** Leak rule for an easier compute: never the item, its answer, or one of its choices. */
export function simplerLeaks(p: ComputeChallenge, c: ComputeChallenge): boolean {
  const theirs = new Set(distributionChoices(c).map(ch => formatValue(Number(ch.key))));
  return p.id === c.id || p.prompt === c.prompt || [p.correctValue, ...p.distractors].some(v => theirs.has(formatValue(v)));
}

// ── predict shape: the shape words, a plainer shape ────────────────────────

export const SHAPE_GUIDE = [
  'right-skewed: most of the values sit on the left and a long tail runs out to the right',
  'symmetric: the left and right halves mirror each other',
  'left-skewed: most of the values sit on the right and a long tail runs out to the left',
];

const isRight = (s: string) => /\bright\b|\bpositive/.test(s.toLowerCase());
const isSymmetric = (s: string) => /symmetric|bell/.test(s.toLowerCase());

/** Leak rule for an easier shape item: never the item, and its answer is not the item's shape. */
export function twoShapesLeaks(p: PredictShapeChallenge, c: PredictShapeChallenge): boolean {
  const same = (a: string, b: string) => (isRight(a) && isRight(b)) || (isSymmetric(a) && isSymmetric(b));
  return p.id === c.id || p.prompt === c.prompt || same(p.acceptableAnswers[0], c.acceptableAnswers[0]) || p.distractors.length !== 1;
}

export function twoShapes(c: DistributionChallenge): PredictShapeChallenge | null {
  if (c.type !== 'predict_shape' || isPractice(c)) return null;
  // A right-skewed item practises a symmetric model, anything else a right-skewed one.
  const p: PredictShapeChallenge = isRight(c.acceptableAnswers[0])
    ? { id: `${c.id}${PRACTICE_SUFFIX}`, type: 'predict_shape', rationale: 'With p = 0.5 the bars mirror around the middle.',
      prompt: 'Practice first. Set the workbench to Binomial with n = 20 and p = 0.5. What is the shape?',
      acceptableAnswers: ['symmetric'], distractors: ['right-skewed'] }
    : { id: `${c.id}${PRACTICE_SUFFIX}`, type: 'predict_shape', rationale: 'The density starts high at 0 and trails off to the right.',
      prompt: 'Practice first. Set the workbench to Exponential with λ (rate) = 1. What is the shape?',
      acceptableAnswers: ['right-skewed'], distractors: ['symmetric'] };
  return twoShapesLeaks(p, c) ? null : p;
}

/** The easier practice item for `c`, of its own type; null when it has none. */
export function practiceItem(c: DistributionChallenge): DistributionChallenge | null {
  return twoFamilies(c) ?? simplerCompute(c) ?? twoShapes(c);
}

// ── the declarations ───────────────────────────────────────────────────────

const COMPUTE: readonly DistributionMiss[] = ['complement', 'reciprocal', 'near_value', 'wrong_value'];
const SHAPE: readonly DistributionMiss[] = ['reversed_skew', 'said_symmetric', 'wrong_shape'];

/** The levers on `c`, with whether each is pulled. A practice item has none. */
export function distributionLevers(c: DistributionChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPractice(c)) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: 'help' | 'simplify', answers: readonly DistributionMiss[], when: string, does: string) =>
    levers.push({ id, kind, when, does, carrier: 'shown', pulled: pulled.includes(id), answers });
  const practice = ' It is not graded; the full item comes back after it.';
  switch (c.type) {
    case 'guided_exploration':
      add(SLIDER_GLOW_LEVER, 'help', ['not_explored'], 'The learner has not moved anything, or does not know where to start.',
        'Rings the slider the prompt is about (every slider when it names none). Never say what the chart will do.');
      return levers;
    case 'identify':
      add(FAMILY_FACTS_LEVER, 'help', ['discrete_continuous', 'binomial_poisson'],
        'The learner mixes up counts and waiting times, or the two counting families.',
        'Puts one line under every choice: what that family models and which values it can take. No choice is marked; '
          + 'never say which line fits the scenario.');
      if (twoFamilies(c)) add(TWO_FAMILIES_LEVER, 'simplify', ['discrete_continuous', 'binomial_poisson'],
        'The learner cannot place this scenario yet.', `Opens an easier ask first: a plainer scenario and two choices.${practice}`);
      return levers;
    case 'compute': {
      const strip = eventStrip(c);
      if (strip && !stripLeaks(stripText(strip), c)) add(EVENT_STRIP_LEVER, 'help', ['complement', 'near_value'],
        'The learner takes the complement, or puts a boundary count in or out.',
        'Shows a strip of the whole counts the asked event takes and the ones it leaves out. No probability; never say '
          + 'the number.');
      if (workedModel(c)) add(WORKED_MODEL_LEVER, 'help', COMPUTE,
        'The learner picks a value from the wrong rule, the complement, the rate for the mean, or a value off by a term.',
        'Shows the same question worked through on a model with other parameter values, step by step to its number. '
          + 'The learner does the same steps on the item; never say the item\'s number.');
      if (simplerCompute(c)) add(SIMPLER_COMPUTE_LEVER, 'simplify', COMPUTE,
        'The learner cannot do this many steps yet.', `Opens an easier ask first: one step less on a model outside the item.${practice}`);
      return levers;
    }
    case 'predict_shape':
      add(SHAPE_GUIDE_LEVER, 'help', SHAPE, 'The learner mixes up the shape words, or reads the tail the wrong way.',
        'Shows a card naming each shape word by where the values sit and which way the long tail runs. It names no '
          + 'answer; never say which word fits.');
      if (twoShapes(c)) add(TWO_SHAPES_LEVER, 'simplify', SHAPE, 'The learner cannot read this shape yet.',
        `Opens an easier ask first: the shape of a stated model, with two choices.${practice}`);
      return levers;
  }
}

/** What the pulled help levers put on screen, for the tutor and JEV. What is drawn, never the key. */
export function leverFacts(c: DistributionChallenge | null, pulled: readonly string[]): string {
  if (!c) return '';
  const on = (id: string) => pulled.includes(id);
  const strip = eventStrip(c), model = workedModel(c), sliders = c.type === 'guided_exploration' ? namedSliders(c.prompt) : [];
  return [
    on(SLIDER_GLOW_LEVER) && c.type === 'guided_exploration' && (sliders.length
      ? `A ring glows around the ${sliders.map(s => (s === 'lambda' ? 'λ' : s)).join(' and ')} slider${sliders.length > 1 ? 's' : ''}.`
      : 'A ring glows around every slider.'),
    on(FAMILY_FACTS_LEVER) && c.type === 'identify' && 'Under every choice is one line: what that family models and which values it can take.',
    on(EVENT_STRIP_LEVER) && strip && `Under the question is a strip of whole counts: ${stripText(strip)}.`,
    on(WORKED_MODEL_LEVER) && model && `Beside the question is a worked model, not the item: ${model.steps.join('; ')}.`,
    on(SHAPE_GUIDE_LEVER) && c.type === 'predict_shape' && 'Beside the choices is a card naming each shape word by where the values sit and which way the long tail runs.',
  ].filter((s): s is string => !!s).join(' ');
}
