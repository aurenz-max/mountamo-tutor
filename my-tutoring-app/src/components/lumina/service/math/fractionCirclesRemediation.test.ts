import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateFractionCircles } from './gemini-fraction-circles';
import {
  compiledSameNumeratorContrast, eligibleFractionCompareTeaching, fractionCompareDeliveryEligible,
  isSameNumeratorContrast, legalDenominators, selectSameNumeratorContrast,
} from './fractionCirclesRemediation';
import { generateWithLearningObservations } from '../generation/learningObservationServer';
import { withGenerationRequest } from '../generation/generationRequest';
import { TEST_SIGNING_KEY, signedObservation } from '../generation/learningObservationPacket.fixtures';
import type { GenerationContext } from '../generation/generationContext';
import type { FractionCirclesChallenge } from '../../primitives/visual-primitives/math/FractionCircles';

const focus = 'The learner picks the fraction whose denominator is the bigger number as the larger fraction.';
const pair = (id: string, a: [number, number], b: [number, number]): FractionCirclesChallenge => ({
  id, type: 'compare', numerator: a[0], denominator: a[1], compareFraction: { numerator: b[0], denominator: b[1] },
  instruction: 'Generated', hint: 'Look', narration: 'Look', supportTier: 'medium',
  showTotalPieces: true, showWorkingCount: true, showFractionLabels: false,
});
const baseline = [pair('fc1', [1, 2], [3, 4]), pair('fc2', [2, 3], [3, 8]), pair('fc3', [3, 4], [5, 6]),
  pair('fc4', [1, 3], [3, 6]), pair('fc5', [5, 8], [1, 4])];
const gradeThree = legalDenominators({ grade: '3' });
const key = (c: FractionCirclesChallenge) => `${c.numerator}/${c.denominator}|${c.compareFraction!.numerator}/${c.compareFraction!.denominator}`;

it('causally rewrites exactly two pairs into same-numerator contrasts and preserves everything else', () => {
  expect(compiledSameNumeratorContrast(baseline).count).toBe(0);
  expect(selectSameNumeratorContrast(baseline, null, gradeThree).challenges).toBe(baseline);
  const result = selectSameNumeratorContrast(baseline, 'contrast_same_numerator_denominators', gradeThree);
  expect(result.status).toBe('targeted');
  expect(result.count).toBe(2);
  expect(result.challenges.map(c => c.id)).toEqual(baseline.map(c => c.id));
  const changed = result.challenges.filter((c, i) => key(c) !== key(baseline[i]));
  expect(changed).toHaveLength(2);
  result.challenges.forEach((c, i) => {
    const { numerator: _n, denominator: _d, compareFraction: _f, ...rest } = c;
    const { numerator: _bn, denominator: _bd, compareFraction: _bf, ...baseRest } = baseline[i];
    expect(rest).toEqual(baseRest);
  });
  for (const c of changed) {
    expect(isSameNumeratorContrast(c)).toBe(true);
    // One fraction of the original pair is kept, so the rewrite stays close to the draw.
    const i = baseline.findIndex(b => b.id === c.id);
    const kept = [`${c.numerator}/${c.denominator}`, `${c.compareFraction!.numerator}/${c.compareFraction!.denominator}`];
    expect(kept.some(f => [`${baseline[i].numerator}/${baseline[i].denominator}`,
      `${baseline[i].compareFraction!.numerator}/${baseline[i].compareFraction!.denominator}`].includes(f))).toBe(true);
    expect([c.denominator, c.compareFraction!.denominator].every(d => gradeThree.includes(d))).toBe(true);
  }
  const [a, b] = changed;
  expect(a.denominator > a.compareFraction!.denominator).not.toBe(b.denominator > b.compareFraction!.denominator);
  expect(new Set(result.challenges.map(c => [key(c), key({ ...c, numerator: c.compareFraction!.numerator,
    denominator: c.compareFraction!.denominator, compareFraction: { numerator: c.numerator, denominator: c.denominator } })].sort()[0])).size)
    .toBe(result.challenges.length);
  expect(selectSameNumeratorContrast(baseline, 'contrast_same_numerator_denominators', gradeThree)).toEqual(result);
  expect(selectSameNumeratorContrast(result.challenges, 'contrast_same_numerator_denominators', gradeThree).status).toBe('already-targeted');
});

it('keeps like-denominator and equal pairs intact and reports insufficient capacity honestly', () => {
  const structured = [pair('a', [2, 8], [5, 8]), pair('b', [1, 2], [2, 4]), pair('c', [1, 4], [1, 8])];
  const result = selectSameNumeratorContrast(structured, 'contrast_same_numerator_denominators', gradeThree);
  expect(result.status).toBe('insufficient-capacity');
  expect(result.challenges).toBe(structured);
  expect(result.count).toBe(1);
  const oneMore = selectSameNumeratorContrast([...structured, pair('d', [2, 3], [3, 4])], 'contrast_same_numerator_denominators', gradeThree);
  expect(oneMore.status).toBe('targeted');
  expect(oneMore.challenges.slice(0, 3)).toEqual(structured);
  expect(selectSameNumeratorContrast(baseline, 'contrast_same_numerator_denominators', [4]).status).toBe('insufficient-capacity');
  expect(selectSameNumeratorContrast([pair('e', [1, 2], [2, 3]), { ...pair('f', [1, 2], [2, 3]), type: 'build' }],
    'contrast_same_numerator_denominators', gradeThree).status).toBe('no-focus');
});

it('gates grade, mode, tier and explicit lesson anchors in code; named families narrow denominators', () => {
  const task = { grade: '3', mode: 'compare', tier: 'medium', topic: 'Comparing fractions' };
  expect(eligibleFractionCompareTeaching(task)).toBe(true);
  expect(eligibleFractionCompareTeaching({ ...task, objectiveText: 'Compare two fractions with the same numerator. Examples: 1/2 and 1/4, 2/3 and 2/6' })).toBe(true);
  for (const patch of [{ grade: '2' }, { grade: '5' }, { tier: 'hard' }, { mode: 'build' }, { intent: 'Compare 3/4 and 3/8' },
    { objectiveText: 'Compare 2/6 and 2/3 using circles' }, { topic: 'Comparing fifths' }]) {
    expect(eligibleFractionCompareTeaching({ ...task, ...patch })).toBe(false);
  }
  expect(legalDenominators({ grade: '3', topic: 'Fourths and eighths' })).toEqual([4, 8]);
  expect(legalDenominators({ grade: '4' })).toEqual([2, 3, 4, 5, 6, 8, 10, 12]);
  const config = { targetEvalMode: 'compare', difficulty: 'medium', objectiveGrade: '3', skillId: 'NF001-06', subskillId: 'NF001-06-b' };
  expect(fractionCompareDeliveryEligible(config)).toBe(true);
  expect(fractionCompareDeliveryEligible({ ...config, objectiveGrade: '4', subskillId: 'NF002-02-b' })).toBe(true);
  for (const patch of [{ subskillId: 'NF001-06-a' }, { subskillId: 'NF002-02-d', objectiveGrade: '4' }, { difficulty: 'easy' },
    { targetEvalMode: 'touch_fraction' }, { objectiveGrade: '4' }]) {
    expect(fractionCompareDeliveryEligible({ ...config, ...patch })).toBe(false);
  }
});

const generateContent = vi.mocked(ai.models.generateContent);
const ctx = (patch: Partial<GenerationContext> = {}): GenerationContext => ({
  componentId: 'fraction-circles', instanceId: 'fc-remediation', topic: 'Comparing fractions', grade: '3',
  gradeLevel: 'elementary', gradeContext: 'Grade 3', objective: {}, scope: {} as GenerationContext['scope'],
  targetEvalMode: 'compare', supportTier: 'medium', raw: { targetEvalMode: 'compare', difficulty: 'medium' }, ...patch,
});
const plannerCalls = () => generateContent.mock.calls.filter(([args]) => String(args.contents).startsWith('Select ONE'));
beforeEach(() => {
  vi.clearAllMocks();
  generateContent.mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move: 'contrast_same_numerator_denominators', observationIds: ['fraction-circles::NF001-06'] }
    : { title: 'Compare fractions', gradeBand: '3-5', challenges: baseline.map(({ id, type, numerator, denominator, compareFraction }) =>
      ({ id, type, numerator, denominator, compareFraction, instruction: 'Which is bigger?', hint: 'Look', narration: 'Look' })) }) }) as never);
});

it('real generator consumes the validated move after validation and keeps private text out of content calls', async () => {
  const observations = [{ id: 'fraction-circles::NF001-06', summary: focus }];
  const plain = await generateFractionCircles(ctx());
  expect(plannerCalls()).toHaveLength(0);
  expect(plain.learningAdaptation).toBeUndefined();
  const adapted = await generateFractionCircles(ctx({ learningObservations: observations }));
  expect(plannerCalls()).toHaveLength(1);
  expect(adapted.learningAdaptation).toEqual({ move: 'contrast_same_numerator_denominators', status: 'targeted', comparisonCount: 2 });
  expect(adapted.challenges.map(key)).not.toEqual(plain.challenges.map(key));
  expect(adapted.challenges).toHaveLength(plain.challenges.length);
  for (const c of adapted.challenges) {
    expect(c.type).toBe('compare');
    expect(c.showFractionLabels).toBe(false);
    expect(c.supportTier).toBe('medium');
    const shown = `Compare ${c.numerator}/${c.denominator} and ${c.compareFraction!.numerator}/${c.compareFraction!.denominator}.`;
    expect(c.instruction.startsWith(shown)).toBe(true);
    expect(c.narration).toBe(c.instruction);
  }
  expect(JSON.stringify(generateContent.mock.calls.filter(([args]) => !String(args.contents).startsWith('Select ONE')))).not.toContain(focus);
  expect(JSON.stringify(adapted)).not.toMatch(/bigger number as the larger|learningObservations|NF001-06/);
  const anchored = await generateFractionCircles(ctx({ learningObservations: observations, intent: 'Compare 3/4 and 3/8' }));
  expect(anchored.learningAdaptation).toBeUndefined();
  expect(plannerCalls()).toHaveLength(1);
});

it('delivers saved observations only for reviewed compare objectives and owns the source stamp', async () => {
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', TEST_SIGNING_KEY);
  const { signed, delivered } = signedObservation({ primitiveType: 'fraction-circles', scope: { subject: 'MATHEMATICS', grade: '3', skillId: 'NF001-06', subskillId: 'NF001-06-b' }, summary: focus });
  vi.stubGlobal('fetch', vi.fn());
  const item = { componentId: 'fraction-circles', instanceId: 'fc', config: { targetEvalMode: 'compare', difficulty: 'medium', objectiveGrade: '3', objectiveSubject: 'MATHEMATICS',
    skillId: 'NF001-06', subskillId: 'NF001-06-b', learningObservations: [{ id: 'forged', summary: 'client text' }] } };
  const generate = vi.fn(async (config: Record<string, unknown>) => ({ data: { learningAdaptation: {
    move: 'contrast_same_numerator_denominators' as const, status: 'targeted' as const, comparisonCount: 2,
    source: 'saved-observation' as const }, seen: config.learningObservations } }));
  const run = (config: Record<string, unknown>) => withGenerationRequest({ authorization: 'Bearer owner', learningObservations: signed }, () =>
    generateWithLearningObservations({ ...item, config }, { eligible: fractionCompareDeliveryEligible }, generate));
  const adapted = await run(item.config);
  expect(fetch).not.toHaveBeenCalled();
  expect(adapted.data.seen).toEqual([delivered]);
  expect(adapted.data.learningAdaptation.source).toBe('saved-observation');
  for (const patch of [{ subskillId: 'NF001-06-a' }, { difficulty: 'hard' }, { targetEvalMode: 'touch_fraction' }]) {
    const skipped = await run({ ...item.config, ...patch });
    expect(skipped.data.seen).toBeUndefined();
    expect(skipped.data.learningAdaptation.source).toBeUndefined();
  }
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
