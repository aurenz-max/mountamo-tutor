import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateComponentContent } from '../geminiService';
import { withGenerationRequest } from './generationRequest';
import { TEST_SIGNING_KEY, signedObservation } from './learningObservationPacket.fixtures';
import { compiledSameFirstContrast } from '../math/tenFrameRemediation';
import type { TenFrameData } from '../../primitives/visual-primitives/math/TenFrame';

// A ten-frame-origin observation, signed into the lesson's delivery packet as the backend issues it.
const { signed, delivered: observation } = signedObservation({ primitiveType: 'ten-frame', scope: { subject: 'MATHEMATICS', grade: 'K', skillId: 'OPS001-02', subskillId: 'OPS001-02-D' },
  summary: 'On ten-frame take-away items the student answers with the starting number instead of how many are left (7 take away 3 answered seven).',
  evidence: { problem: 'Ten frame (subtract)', evalMode: 'operate', phases: [{ phase: 'operate', challenge: '7 counters on a frame of 10; the tutor said to take away 3.', expected: 'four (4) left', observed: 'Said "seven".', support: 'Correction observation' }] } });
const item = { componentId: 'ten-frame', instanceId: 'left', title: 'Take away', intent: 'Take away on the ten frame and say how many are left', config: {
  objectiveSubject: 'MATHEMATICS', objectiveGrade: 'K', skillId: 'OPS001-02', subskillId: 'OPS001-02-D', targetEvalMode: 'operate', difficulty: 'medium',
  objectiveText: 'Model and solve subtraction problems within 10 using ten frames and number lines' } };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); });
function stubEngines(move: string) {
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', TEST_SIGNING_KEY);
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move, observationIds: [observation.id] }
    : { title: 'Take Away', description: 'd', mode: 'single', gradeBand: 'K', counters: { count: 0, color: 'red', positions: [] },
      showOptions: { showCount: false, showEquation: false, showEmptyCount: false, allowFlip: false },
      challenges: [[5, 2], [6, 2], [7, 5], [8, 3], [9, 5]].map(([s, r], i) => ({ id: `c${i + 1}`, type: 'subtract', startCount: s, targetCount: s - r, hint: 'h', narration: 'n' })) }) }) as never);
}
const generate = async (patch: Record<string, unknown> = {}, learningObservations: unknown = signed) =>
  (await withGenerationRequest({ authorization: 'Bearer owner', learningObservations }, () => generateComponentContent({ ...item, config: { ...item.config, ...patch } } as never,
    'Subtraction within 10', 'Kindergarten')) as { data: TenFrameData }).data;
const plannerPrompts = () => vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => c.startsWith('Select ONE'));

it('a saved observation reaches the real registry generator through the catalog declaration and stays private', async () => {
  stubEngines('contrast_same_first_number_different_second');
  const data = await generate();
  expect(fetch).not.toHaveBeenCalled();
  expect(plannerPrompts()).toHaveLength(1);
  expect(plannerPrompts()[0]).toContain(observation.id);
  expect(plannerPrompts()[0]).toContain('answered seven');
  expect(data.learningAdaptation).toMatchObject({ move: 'contrast_same_first_number_different_second', source: 'saved-observation' });
  expect(compiledSameFirstContrast(data.challenges, 10).count).toBeGreaterThan(0);
  expect(JSON.stringify(data)).not.toMatch(new RegExp(`${observation.id}|instead of how many are left`));
  const generationPrompts = vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => !c.startsWith('Select ONE'));
  expect(generationPrompts.join('\n')).not.toMatch(new RegExp(`${observation.id}|instead of how many are left`));
});

it('no delivery in an ineligible mode or without a packet; a forged client observation is stripped; an abstention claims no origin', async () => {
  stubEngines('contrast_same_first_number_different_second');
  expect((await generate({ targetEvalMode: 'make_ten' })).learningAdaptation).toBeUndefined();
  expect(await generate({}, null)).not.toHaveProperty('learningAdaptation');
  expect(await generate({ learningObservations: [observation] }, null)).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(0);
  stubEngines('abstain');
  expect(await generate()).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(1);
});
