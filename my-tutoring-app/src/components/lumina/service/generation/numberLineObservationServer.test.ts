import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateComponentContent } from '../geminiService';
import { withGenerationRequest } from './generationRequest';
import { compiledStartContrast } from '../math/numberLineRemediation';
import type { NumberLineData } from '../../primitives/visual-primitives/math/NumberLine';

// A number-line-origin observation, as the shared delivery endpoint returns it.
const observation = { id: 'observation-7c2d', summary: 'When hopping, the learner counts the start number as one, so each landing is a hop short.',
  evidence: '{"evalMode":"jump","phases":[{"phase":"single jump","expected":"landing at 11","observed":"Incorrect: landing placed at 10, 2 spaces right of 8"}]}' };
const item = { componentId: 'number-line', instanceId: 'line', title: 'Hops', intent: 'Count on to add on a number line', config: {
  objectiveSubject: 'MATHEMATICS', objectiveGrade: '1', skillId: 'OPS001-03', subskillId: 'OPS001-03-a', targetEvalMode: 'jump', difficulty: 'medium',
  objectiveText: 'Add two numbers within 20 by counting on from the larger addend on a number line.', numberRange: { min: 0, max: 20 } } };
const topic = 'Add within 20 by counting on';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); });
function stubEngines(move: string) {
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', 'synthetic-test-secret-never-for-production');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true, observations: [observation] }) }));
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move, observationIds: [observation.id] }
    : { title: 'Hop along', description: 'Jumps show adding.', instruction: 'Hop from the start.', hint: 'Count each hop.' }) }) as never);
}
const run = async (patch: Record<string, unknown> = {}, authorization: string | null = 'Bearer owner') =>
  (await withGenerationRequest(authorization, () => generateComponentContent({ ...item, config: { ...item.config, ...patch } } as never, topic, 'Grade 1')) as { data: NumberLineData }).data;
const plannerPrompts = () => vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => c.startsWith('Select ONE'));
const tuples = (data: NumberLineData) => data.challenges!.map(c => ({ startValue: c.operations![0].startValue, opType: c.operations![0].type,
  change: c.operations![0].changeValue, targetValue: c.targetValues[0] }));

it('a saved number-line observation reaches the real registry generator, shapes the jumps, and stays private', async () => {
  stubEngines('contrast_start_positions');
  const data = await run();
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/api/student-profile/learning-observation-context');
  expect(JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body)))
    .toEqual({ scope: { subject: 'MATHEMATICS', grade: '1', skill_id: 'OPS001-03', subskill_id: 'OPS001-03-a' } });
  expect(plannerPrompts()).toHaveLength(1);
  expect(plannerPrompts()[0]).toContain(observation.summary);
  expect(plannerPrompts()[0]).toContain('landing placed at 10');
  expect(data.learningAdaptation).toMatchObject({ move: 'contrast_start_positions', comparisonCount: 2, source: 'saved-observation' });
  expect(['targeted', 'already-targeted']).toContain(data.learningAdaptation!.status);
  expect(compiledStartContrast(tuples(data)).count).toBe(2);
  expect(data.challenges).toHaveLength(4);
  expect(JSON.stringify(data)).not.toContain(observation.summary);
  expect(JSON.stringify(data)).not.toContain('observation-7c2d');
});

it('no delivery for unreviewed objectives, other tiers or modes, or without learner credentials', async () => {
  stubEngines('contrast_start_positions');
  for (const patch of [{ subskillId: 'NBT001-07-b', skillId: 'NBT001-07' }, { difficulty: 'hard' }, { targetEvalMode: 'plot' }, { objectiveGrade: '2' }]) {
    const data = await run(patch);
    expect(data.learningAdaptation).toBeUndefined();
  }
  expect(fetch).not.toHaveBeenCalled();
  expect(await run({}, null)).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(0);
});

it('a planner abstention on delivered observations leaves ordinary generation and no origin claim', async () => {
  stubEngines('abstain');
  const data = await run();
  expect(plannerPrompts()).toHaveLength(1);
  expect(data.learningAdaptation).toBeUndefined();
});
