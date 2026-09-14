import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateComponentContent } from '../geminiService';
import { withGenerationRequest } from './generationRequest';
import { TEST_SIGNING_KEY, signedObservation } from './learningObservationPacket.fixtures';
import { compiledBlockWorthContrast } from '../math/baseTenRemediation';
import type { BaseTenBlocksData } from '../../primitives/visual-primitives/math/BaseTenBlocks';

// A blocks-origin observation, signed into the lesson's delivery packet as the backend issues it.
const { signed, delivered: observation } = signedObservation({ primitiveType: 'base-ten-blocks', scope: { subject: 'MATHEMATICS', grade: '4', skillId: 'NBT004-01', subskillId: 'NBT004-01-b' },
  summary: 'Asked what the blocks in a column are worth, the student says how many blocks there are.',
  evidence: { problem: 'Read the blocks', evalMode: 'read_blocks', phases: [{ phase: 'worth', challenge: 'tens column', expected: 'forty', observed: 'four', support: 'none' }] } });
const challenges = [2305, 5406, 6708].map(targetNumber => ({ type: 'read_blocks', targetNumber, instruction: 'Read the blocks.',
  hint: 'Look carefully.', showColumnCounts: false, showBlocksTotal: false }));
const item = { componentId: 'base-ten-blocks', instanceId: 'blocks', title: 'Blocks', intent: 'Read a block mat', config: {
  objectiveSubject: 'MATHEMATICS', objectiveGrade: '4', skillId: 'NBT004-01', subskillId: 'NBT004-01-b', targetEvalMode: 'read_blocks', difficulty: 'medium',
  objectiveText: 'Identify the value of each digit in a whole number' } };
const topic = 'Place value in four-digit whole numbers';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function stubEngines(move: string) {
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', TEST_SIGNING_KEY);
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move, observationIds: [observation.id] }
    : { title: 'Read the blocks', description: 'Look at the mat.', numberValue: 2305, gradeBand: '4-5', maxPlace: 'thousands',
      interactionMode: 'decompose', challenges }) }) as never);
}
const run = async (patch: Record<string, unknown> = {}, learningObservations: unknown = signed) =>
  (await withGenerationRequest({ authorization: 'Bearer owner', learningObservations }, () => generateComponentContent({ ...item, config: { ...item.config, ...patch } } as never, topic, 'Grade 4')) as { data: BaseTenBlocksData }).data;
const plannerPrompts = () => vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => c.startsWith('Select ONE'));

it('a saved blocks observation reaches the real registry generator, changes the compiled mats, and stays private', async () => {
  stubEngines('contrast_block_count_and_worth');
  const data = await run();
  expect(fetch).not.toHaveBeenCalled();
  expect(plannerPrompts()).toHaveLength(1);
  expect(plannerPrompts()[0]).toContain(observation.summary);
  expect(data.learningAdaptation).toMatchObject({ move: 'contrast_block_count_and_worth', status: 'targeted', comparisonCount: 2, source: 'saved-observation' });
  expect(compiledBlockWorthContrast(data.challenges!).count).toBe(2);
  expect(compiledBlockWorthContrast(challenges as never).count).toBe(0);
  expect(data.supportTier).toBe('medium');
  expect(data.challenges!.every(c => c.type === 'read_blocks' && !c.showColumnCounts && !c.showBlocksTotal)).toBe(true);
  const wrapperPrompts = vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => !c.startsWith('Select ONE'));
  expect(wrapperPrompts.join('\n')).not.toContain(observation.summary);
  expect(JSON.stringify(data)).not.toMatch(new RegExp(`how many blocks there are|${observation.id}|learningObservations|misconceptionOpportunity`));
});

it('abstention leaves the baseline, and ineligible tasks or requests without a packet never plan', async () => {
  stubEngines('abstain');
  const abstained = await run();
  expect(abstained.learningAdaptation).toBeUndefined();
  expect(abstained.challenges!.map(c => c.targetNumber)).toEqual(challenges.map(c => c.targetNumber));
  vi.mocked(fetch).mockClear();
  for (const patch of [{ objectiveGrade: '3' }, { targetEvalMode: 'regroup' }, { difficulty: 'hard' }]) await run(patch);
  await run({}, null);
  expect(fetch).not.toHaveBeenCalled();
  expect(plannerPrompts()).toHaveLength(1);
});

it('a client-supplied observation list is dropped before generation', async () => {
  stubEngines('contrast_block_count_and_worth');
  const data = await run({ learningObservations: [observation] }, null);
  expect(plannerPrompts()).toHaveLength(0);
  expect(data.learningAdaptation).toBeUndefined();
});
