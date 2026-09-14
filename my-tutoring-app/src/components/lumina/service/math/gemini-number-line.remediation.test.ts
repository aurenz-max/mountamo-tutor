/**
 * The number-line jump generator consumes a validated applicability move.
 * Real generator, mocked model, seeded Math.random: the baseline tuples are held
 * constant, so a difference between runs is caused by the adapter. Removing the
 * selector call makes the "targeted" test fail (its baseline has no contrast).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('server-only', () => ({}));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));

import { ai } from '../geminiClient';
import { generateNumberLine } from './gemini-number-line';
import { compiledStartContrast, type JumpTuple } from './numberLineRemediation';

const generateContent = vi.mocked(ai.models.generateContent);
const PRIVATE = 'The learner says the number they start on as the first hop, so every landing is one space short of the jump.';

function seed(value: number) {
  let state = value;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  });
}

function context(patch: Partial<GenerationContext> = {}, raw: Record<string, unknown> = {}): GenerationContext {
  return {
    componentId: 'number-line', instanceId: 'nl-remediation', topic: 'Add within 20 by counting on',
    gradeLevel: 'elementary', gradeContext: 'elementary students (grades 1-5)', grade: '1',
    intent: 'Count on to add on a number line', objective: { text: 'Add two numbers within 20 by counting on.' },
    scope: {} as GenerationContext['scope'], targetEvalMode: 'jump', supportTier: 'medium',
    raw: { targetEvalMode: 'jump', difficulty: 'medium', numberRange: { min: 0, max: 20 }, ...raw },
    ...patch,
  };
}

const plannerCalls = () => generateContent.mock.calls.filter(([args]) => args.model === 'gemini-flash-latest');
const tuplesOf = (data: Awaited<ReturnType<typeof generateNumberLine>>): JumpTuple[] => data.challenges!.map(c => {
  const op = c.operations![0];
  return { startValue: op.startValue, opType: op.type, change: op.changeValue, targetValue: c.targetValues[0] };
});

let plannerMove: string;
beforeEach(() => {
  plannerMove = 'contrast_start_positions';
  generateContent.mockReset();
  generateContent.mockImplementation(async (args: { model: string; contents: unknown }) => ({
    text: args.model === 'gemini-flash-latest'
      ? JSON.stringify(plannerMove === 'abstain' ? { move: 'abstain', observationIds: [] } : { move: plannerMove, observationIds: ['o1'] })
      : JSON.stringify({ title: 'Hop along', description: 'Jumps as adding and subtracting.', instruction: 'Hop from the start.', hint: 'Count each hop.' }),
  }) as never);
});
afterEach(() => vi.restoreAllMocks());

describe('number-line learning adaptation', () => {
  it('holds the seeded baseline without observations and makes no planner call', async () => {
    seed(7);
    const baseline = await generateNumberLine(context());
    expect(plannerCalls()).toHaveLength(0);
    expect(baseline.learningAdaptation).toBeUndefined();
    expect(compiledStartContrast(tuplesOf(baseline)).count).toBe(0);
    seed(7);
    expect(tuplesOf(await generateNumberLine(context()))).toEqual(tuplesOf(baseline));
  });

  it('executes the validated move on the same baseline and preserves the task', async () => {
    seed(7);
    const baseline = tuplesOf(await generateNumberLine(context()));
    generateContent.mockClear();
    seed(7);
    const data = await generateNumberLine(context({ learningObservations: [{ id: 'o1', summary: PRIVATE, evidence: 'try 1: placed 10 for 8 + 3' }] }));
    const adapted = tuplesOf(data);

    expect(plannerCalls()).toHaveLength(1);
    expect(String(plannerCalls()[0][0].contents)).toContain(PRIVATE);
    expect(data.learningAdaptation).toEqual({ move: 'contrast_start_positions', status: 'targeted', comparisonCount: 2 });
    expect(compiledStartContrast(adapted).count).toBe(2);
    expect(adapted).toHaveLength(baseline.length);
    expect(adapted.filter((t, i) => JSON.stringify(t) !== JSON.stringify(baseline[i]))).toHaveLength(1);
    for (const [c, t] of data.challenges!.map((c, i) => [c, adapted[i]] as const)) {
      expect(c.type).toBe('show_jump');
      expect(c.operations).toHaveLength(1);
      expect(c.operations![0].showJumpArc).toBe(false);
      expect(c.startValue).toBe(t.startValue);
      expect(t.opType === 'add' ? t.startValue + t.change : t.startValue - t.change).toBe(t.targetValue);
      expect([1, 2, 3, 4, 5]).toContain(t.change);
      expect(t.targetValue).toBeGreaterThanOrEqual(0);
      expect(t.targetValue).toBeLessThanOrEqual(20);
    }
    expect(data.supportTier).toBe('medium');
    expect(data.range).toEqual({ min: 0, max: 20 });
    // The instruction model was asked about the start each challenge actually shows.
    const textPrompts = generateContent.mock.calls.filter(([args]) => args.model !== 'gemini-flash-latest').map(([args]) => String(args.contents));
    adapted.forEach(t => expect(textPrompts.some(p => p.includes(`Start position: ${t.startValue}\n`))).toBe(true));
    // Private observation text reaches only the planner.
    expect(textPrompts.join('\n')).not.toContain(PRIVATE);
    expect(JSON.stringify(data)).not.toContain(PRIVATE);
  });

  it('uses a saved remediation focus when no structured observations are delivered', async () => {
    seed(7);
    await generateNumberLine(context({ remediationFocus: PRIVATE }));
    expect(plannerCalls()).toHaveLength(1);
  });

  it('abstains safely: planner abstention or an unknown move leaves the baseline', async () => {
    seed(7);
    const baseline = tuplesOf(await generateNumberLine(context()));
    for (const move of ['abstain', 'invented_move']) {
      plannerMove = move;
      seed(7);
      const data = await generateNumberLine(context({ learningObservations: [{ id: 'o1', summary: PRIVATE }] }));
      expect(data.learningAdaptation).toBeUndefined();
      expect(tuplesOf(data)).toEqual(baseline);
    }
  });

  it.each([
    ['hard tier', { supportTier: 'hard' as const }, { difficulty: 'hard' }],
    ['plot mode', { targetEvalMode: 'plot' }, { targetEvalMode: 'plot' }],
    ['grade 4', { grade: '4' }, {}],
    ['named problem', { topic: 'Show 8 + 3 on a number line' }, {}],
  ])('never calls the planner for an ineligible task: %s', async (_name, patch, raw) => {
    seed(7);
    await generateNumberLine(context({ ...patch, learningObservations: [{ id: 'o1', summary: PRIVATE }] }, raw));
    expect(plannerCalls()).toHaveLength(0);
  });

  it('reports insufficient capacity honestly when zero is outside the lesson range', async () => {
    seed(7);
    const data = await generateNumberLine(context({ learningObservations: [{ id: 'o1', summary: PRIVATE }] }, { numberRange: { min: 10, max: 20 } }));
    expect(data.learningAdaptation).toEqual({ move: 'contrast_start_positions', status: 'insufficient-capacity', comparisonCount: 0 });
    expect(tuplesOf(data).every(t => t.startValue >= 10 && t.targetValue >= 10)).toBe(true);
  });
});
