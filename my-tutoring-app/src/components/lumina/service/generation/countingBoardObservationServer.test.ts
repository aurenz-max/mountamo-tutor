import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateComponentContent } from '../geminiService';
import { withGenerationRequest } from './generationRequest';
import { TEST_SIGNING_KEY, signedObservation } from './learningObservationPacket.fixtures';
import { compiledSameStartContrast } from '../math/countingBoardRemediation';
import type { CountingBoardData } from '../../primitives/visual-primitives/math/CountingBoard';

// A counting-board-origin observation, signed into the lesson's delivery packet as the backend issues it.
const { signed, delivered: observation } = signedObservation({ primitiveType: 'counting-board', scope: { subject: 'MATHEMATICS', grade: 'K', skillId: 'COUNT001-02', subskillId: 'COUNT001-02-E' },
  summary: 'On take-away boards the student reports how many objects were on the board before any were removed (7 take away 3 answered seven).',
  evidence: { problem: 'Take away', evalMode: 'take_away', phases: [{ phase: 'take-away', challenge: '7 bears on the board; the tutor said to take away 3. Say how many are left.', expected: 'four (4) left', observed: 'Said "seven".', support: 'Correction observation' }] } });
const item = { componentId: 'counting-board', instanceId: 'left', title: 'Take away', intent: 'Count how many are left after taking some away', config: {
  objectiveSubject: 'MATHEMATICS', objectiveGrade: 'K', skillId: 'COUNT001-02', subskillId: 'COUNT001-02-E', targetEvalMode: 'take_away', difficulty: 'medium',
  objectiveText: 'Compare quantities between groups and count backwards from 10 using concrete objects' } };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); });
function stubEngines(move: string) {
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', TEST_SIGNING_KEY);
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move, observationIds: [observation.id] }
    : { title: 'Take Away', description: 'Count what is left.', objects: { type: 'bears' }, gradeBand: 'K',
      showOptions: { showRunningCount: false, showGroupCircles: false, highlightOnTap: true, showLastNumber: true },
      challenges: [5, 6, 8, 9, 10].map((count, i) => ({ id: `c${i + 1}`, type: 'take_away', instruction: 'Take some away.', targetAnswer: count, count,
        arrangement: 'line', hint: 'h', narration: 'n' })) }) }) as never);
}
const generate = async (patch: Record<string, unknown> = {}, learningObservations: unknown = signed) =>
  (await withGenerationRequest({ authorization: 'Bearer owner', learningObservations }, () => generateComponentContent({ ...item, config: { ...item.config, ...patch } } as never,
    'Counting back from 10', 'Kindergarten')) as { data: CountingBoardData }).data;
const plannerPrompts = () => vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => c.startsWith('Select ONE'));

it('a saved observation reaches the real registry generator through the catalog declaration and stays private', async () => {
  stubEngines('contrast_same_start_different_change');
  const data = await generate();
  expect(fetch).not.toHaveBeenCalled();
  expect(plannerPrompts()).toHaveLength(1);
  expect(plannerPrompts()[0]).toContain(observation.id);
  expect(plannerPrompts()[0]).toContain('answered seven');
  expect(data.learningAdaptation).toMatchObject({ move: 'contrast_same_start_different_change', source: 'saved-observation' });
  expect(compiledSameStartContrast(data.challenges).count).toBeGreaterThan(0);
  expect(JSON.stringify(data)).not.toMatch(new RegExp(`${observation.id}|before any were removed`));
  const generationPrompts = vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => !c.startsWith('Select ONE'));
  expect(generationPrompts.join('\n')).not.toMatch(new RegExp(`${observation.id}|before any were removed`));
});

it('no delivery in an ineligible mode or without a packet; a forged client observation is stripped; an abstention claims no origin', async () => {
  stubEngines('contrast_same_start_different_change');
  expect((await generate({ targetEvalMode: 'count' })).learningAdaptation).toBeUndefined();
  expect(await generate({}, null)).not.toHaveProperty('learningAdaptation');
  expect(await generate({ learningObservations: [observation] }, null)).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(0);
  stubEngines('abstain');
  expect(await generate()).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(1);
});
