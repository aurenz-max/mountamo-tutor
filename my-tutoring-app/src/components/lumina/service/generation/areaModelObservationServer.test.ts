import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateComponentContent } from '../geminiService';
import { withGenerationRequest } from './generationRequest';
import { TEST_SIGNING_KEY, signedObservation } from './learningObservationPacket.fixtures';
import { compiledSameFactContrast } from '../math/areaModelRemediation';
import type { AreaModelData } from '../../primitives/visual-primitives/math/AreaModel';

// An area-model-origin observation, signed into the lesson's delivery packet as the backend issues it.
const { signed, delivered: observation } = signedObservation({ primitiveType: 'area-model', scope: { subject: 'MATHEMATICS', grade: '4', skillId: 'NBT004-06', subskillId: 'NBT004-06-d' },
  summary: 'In cells whose parts are multiples of ten, the student multiplies the leading digits and drops the zeros (30 × 40 entered as 12).',
  evidence: { problem: 'Area model', evalMode: 'find_area', phases: [{ phase: 'cell', challenge: '30 × 40', expected: '1200', observed: 'Incorrect: entered 12', support: 'none' }] } });
const item = { componentId: 'area-model', instanceId: 'grid', title: 'Area models', intent: 'Multiply two-digit numbers using partial products', config: {
  objectiveSubject: 'MATHEMATICS', objectiveGrade: '4', skillId: 'NBT004-06', subskillId: 'NBT004-06-d', targetEvalMode: 'find_area', difficulty: 'medium',
  objectiveText: 'Multiply two-digit by two-digit numbers using an area model grid.' } };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); });
function stubEngines(move: string) {
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', TEST_SIGNING_KEY);
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move, observationIds: [observation.id] }
    : { title: 'Area Model Practice', description: 'Split each factor into parts.' }) }) as never);
}
const run = async (patch: Record<string, unknown> = {}, learningObservations: unknown = signed) =>
  (await withGenerationRequest({ authorization: 'Bearer owner', learningObservations }, () => generateComponentContent({ ...item, config: { ...item.config, ...patch } } as never,
    'Multiply two-digit numbers with an area model', 'Grade 4')) as { data: AreaModelData }).data;
const plannerPrompts = () => vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => c.startsWith('Select ONE'));

it('a saved observation reaches the real registry generator through the catalog declaration and stays private', async () => {
  stubEngines('contrast_same_fact_across_places');
  const data = await run();
  expect(fetch).not.toHaveBeenCalled();
  expect(plannerPrompts()).toHaveLength(1);
  expect(plannerPrompts()[0]).toContain(observation.id);
  expect(plannerPrompts()[0]).toContain('entered 12');
  expect(data.learningAdaptation).toMatchObject({ move: 'contrast_same_fact_across_places', source: 'saved-observation' });
  expect(compiledSameFactContrast(data.challenges).count).toBeGreaterThan(0);
  expect(JSON.stringify(data)).not.toMatch(new RegExp(`${observation.id}|drops the zeros`));
});

it('no delivery in factor mode or without a packet; an abstention claims no origin', async () => {
  stubEngines('contrast_same_fact_across_places');
  expect((await run({ targetEvalMode: 'factor' })).learningAdaptation).toBeUndefined();
  expect(await run({}, null)).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(0);
  stubEngines('abstain');
  expect(await run()).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(1);
});
