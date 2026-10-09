/**
 * distribution-explorer levers: the leak rules per mode, the simplify builders over many item shapes, and "this wrong
 * answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { nextLever } from '../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../service/manifest/catalog';
import type { ComputeChallenge, DistributionChallenge, DistributionFamily, IdentifyChallenge, PredictShapeChallenge } from './types';
import { DISTRIBUTION_MISSES_BY_MODE, distributionChoices, distributionCorrect } from './distributionExplorerWorkspace';
import {
  askedOf, distributionLevers, printsNumber, eventStrip, familyFactsLeak, leverFacts, simplerCompute, simplerLeaks, stripLeaks, stripText,
  twoFamilies, twoFamiliesLeaks, twoShapes, twoShapesLeaks, valueOf, workedModel, workedModelLeaks,
} from './distributionExplorerLevers';

const PAYLOADS = join(__dirname, '../../components/live-activity/runtime/testing/w1-payloads');
const saved: DistributionChallenge[] = readdirSync(PAYLOADS).filter(f => f.startsWith('distribution-explorer.'))
  .flatMap(f => JSON.parse(readFileSync(join(PAYLOADS, f), 'utf8')).data.challenges);

const FAMILIES: DistributionFamily[] = ['binomial', 'poisson', 'exponential'];
const r4 = (n: number) => Number(n.toFixed(4));

/** Compute items the generator writes, over the families, parameters and asked events. */
function computes(): ComputeChallenge[] {
  const out: ComputeChallenge[] = [];
  const asks = ['Find E[X].', 'Find Var[X].', 'Find P(X = 2).', 'Find P(no claims tomorrow).', 'Find P(X ≥ 3).',
    'Find the probability of at most 2 events.', 'Find P(X > 1).', 'Find the probability of fewer than 4 events.'];
  let i = 0;
  for (const lambda of [1, 2.5, 3, 4, 5, 7, 9]) for (const prompt of asks) {
    const c: ComputeChallenge = { id: `p${i++}`, type: 'compute', scenario: `Claims arrive as a Poisson process at λ = ${lambda} per day.`, prompt,
      rationale: '', correctValue: 0, distractors: [] };
    const a = askedOf(c)!;
    const key = r4(valueOf(a));
    out.push({ ...c, correctValue: key, distractors: [r4(1 - key), r4(key * 1.3 + 0.01), r4(1 / Math.max(key, 0.01))] });
  }
  for (const [n, p] of [[10, 0.3], [20, 0.5], [8, 0.75]]) for (const prompt of ['Find E[X].', 'Find P(X ≥ 6).', 'Find P(X ≤ 3).']) {
    const c: ComputeChallenge = { id: `b${i++}`, type: 'compute', scenario: `X ~ Binomial(${n}, ${p}).`, prompt, rationale: '', correctValue: 0, distractors: [] };
    const key = r4(valueOf(askedOf(c)!));
    out.push({ ...c, correctValue: key, distractors: [r4(1 - key), r4(key * 1.3 + 0.01), r4(key / 2 + 0.003)] });
  }
  for (const rate of [0.2, 0.5, 2]) for (const prompt of ['Find the mean wait E[T].', 'Find P(T > 2).', 'Find the probability it fails within 0.5 years.']) {
    const c: ComputeChallenge = { id: `e${i++}`, type: 'compute', scenario: `Lifetime ~ Exponential with rate ${rate}/year.`, prompt, rationale: '', correctValue: 0, distractors: [] };
    const key = r4(valueOf(askedOf(c)!));
    out.push({ ...c, correctValue: key, distractors: [r4(1 - key), r4(rate), r4(key * 1.5 + 0.02)] });
  }
  return out;
}

describe('reading the asked quantity', () => {
  it('reads the saved payloads and the worked examples', () => {
    const read = (scenario: string, prompt: string) => askedOf({ id: 'x', type: 'compute', scenario, prompt, rationale: '', correctValue: 0, distractors: [] });
    expect(read('A portfolio has losses modeled by a Poisson process with lambda = 4 per month.', 'Determine the expected number of events E[X] for this stochastic process.'))
      .toMatchObject({ family: 'poisson', params: { lambda: 4 }, kind: 'mean' });
    expect(read('Claims arrive at λ=3/day.', 'P(no claims tomorrow) = ?')).toMatchObject({ kind: 'point', k: 0, params: { lambda: 3 } });
    expect(read('X ~ Binomial(10, 0.3).', 'Find E[X].')).toMatchObject({ family: 'binomial', params: { n: 10, p: 0.3 } });
    expect(read('Equipment lifetime ~ Exp(rate 0.2/year).', 'Given it survived 3 years, find P(survives more than 2 more).'))
      .toMatchObject({ family: 'exponential', params: { lambda: 0.2 }, kind: 'more_than', k: 2 });
    expect(r4(valueOf(read('X ~ Poisson(5).', 'Find P(X ≥ 3).')!))).toBe(0.8753);
    expect(r4(valueOf(read('Claims at λ=3/day.', 'P(no claims) = ?')!))).toBe(0.0498);
  });
});

describe('leak rules', () => {
  it('the family facts name no family and say the same kind of thing for each', () => { expect(familyFactsLeak()).toBe(false); });

  it.each(computes().map(c => [c.id, c] as const))('compute %s: the worked model uses other values and prints no choice; the strip prints no probability', (_, c) => {
    const model = workedModel(c);
    expect(model, 'every generated shape has a model').not.toBeNull();
    expect(workedModelLeaks(model!.asked, c, model!.steps)).toBe(false);
    expect(printsNumber(model!.steps.join(' '), String(c.correctValue))).toBe(false);
    const strip = eventStrip(c);
    if (strip) expect(stripLeaks(stripText(strip), c)).toBe(false);
    const facts = leverFacts(c, ['event_strip', 'worked_model']);
    const own = `${c.scenario} ${c.prompt}`;
    for (const choice of distributionChoices(c)) {
      if (!printsNumber(own, choice.key)) expect(printsNumber(facts, choice.key) ? choice.label : null).toBeNull();
    }
  });

  it.each(computes().map(c => [c.id, c] as const))('compute %s: the easier item is one step less, solvable, never the item', (_, c) => {
    const p = simplerCompute(c);
    const kind = askedOf(c)!.kind;
    if (kind === 'mean' || kind === 'variance' || kind === 'point') { expect(p).toBeNull(); return; }
    expect(p).not.toBeNull();
    expect(simplerLeaks(p!, c)).toBe(false);
    expect(askedOf(p!)!.kind).toBe(askedOf(c)!.family === 'exponential' ? 'mean' : 'point');
    expect(distributionChoices(p!).filter(ch => distributionCorrect(p!, { picked: ch.key, explored: false, family: 'binomial', params: {} }))).toHaveLength(1);
  });

  it.each(FAMILIES)('identify %s: the easier scenario never asks for the item\'s family', (f) => {
    const c: IdentifyChallenge = { id: 'i', type: 'identify', prompt: 'Which?', rationale: '', correctFamily: f, distractors: FAMILIES.filter(x => x !== f) };
    const p = twoFamilies(c)!;
    expect(twoFamiliesLeaks(p, c)).toBe(false);
    expect(p.correctFamily).not.toBe(f);
  });

  it.each(['right-skewed', 'symmetric', 'left-skewed'])('shape %s: the easier model\'s answer is another shape', (key) => {
    const c: PredictShapeChallenge = { id: 's', type: 'predict_shape', prompt: 'Shape?', rationale: '', acceptableAnswers: [key], distractors: ['uniform', 'bimodal'] };
    const p = twoShapes(c)!;
    expect(twoShapesLeaks(p, c)).toBe(false);
  });
});

describe('this wrong answer, then this lever', () => {
  it.each(saved.map(c => [c.id + ':' + c.type, c] as const))('saved item %s: every miss of its mode is answered by a lever on it', (_, c) => {
    const mode = c.type === 'guided_exploration' ? 'explore' : c.type === 'identify' ? 'identify' : c.type === 'predict_shape' ? 'compute_advanced' : 'compute_basic';
    const misses = DISTRIBUTION_MISSES_BY_MODE[mode].filter(m => c.type !== 'compute' || !['reversed_skew', 'said_symmetric', 'wrong_shape'].includes(m))
      .filter(m => c.type !== 'predict_shape' || ['reversed_skew', 'said_symmetric', 'wrong_shape'].includes(m));
    const levers = distributionLevers(c, []);
    for (const miss of misses) expect(levers.some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
  });

  it('the help comes before the simplify for each miss', () => {
    const c = computes().find(x => /≥/.test(x.prompt))!;
    expect(nextLever(distributionLevers(c, []), 'complement')).toBe('event_strip');
    expect(nextLever(distributionLevers(c, []), 'reciprocal')).toBe('worked_model');
    expect(nextLever(distributionLevers(c, ['event_strip', 'worked_model']), 'complement')).toBe('simpler_compute');
  });

  it('the catalog declares levers', () => {
    expect(getComponentById('distribution-explorer')!.teachingWorkspace!.levers).toBe(true);
  });
});
