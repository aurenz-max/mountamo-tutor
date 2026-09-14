import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateComponentContent } from '../geminiService';
import { withGenerationRequest } from './generationRequest';
import { TEST_SIGNING_KEY, signedObservation } from './learningObservationPacket.fixtures';
import { compiledGapPositionContrast } from '../math/numberTracerRemediation';
import type { NumberTracerData } from '../../primitives/visual-primitives/math/NumberTracer';

// A number-tracer-origin observation, signed into the lesson's delivery packet as the backend issues it.
const { signed, delivered: observation } = signedObservation({ primitiveType: 'number-tracer', scope: { subject: 'MATHEMATICS', grade: 'K', skillId: 'COUNT001-01', subskillId: 'COUNT001-01-D' },
  summary: 'In counting runs the student writes the number that follows the last shown number instead of the hidden one (3, 4, ?, 6 written as 7).',
  evidence: { problem: 'Missing numbers', evalMode: 'sequence', phases: [{ phase: 'sequence', challenge: '3, 4, ?, 6', expected: '5', observed: 'Incorrect: the judge read the drawing as 7 (score 10)', support: 'none' }] } });
const item = { componentId: 'number-tracer', instanceId: 'runs', title: 'Missing numbers', intent: 'Find and write the missing number in a counting sequence', config: {
  objectiveSubject: 'MATHEMATICS', objectiveGrade: 'K', skillId: 'COUNT001-01', subskillId: 'COUNT001-01-D', targetEvalMode: 'sequence', difficulty: 'medium',
  objectiveText: 'Demonstrate sequential understanding through 20 (before/after, missing numbers).' } };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); });
function stubEngines(move: string) {
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', TEST_SIGNING_KEY);
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move, observationIds: [observation.id] }
    : String(args.contents).includes('rangeMin')
      ? { title: 'Missing Numbers', description: 'Find the hidden number.', rangeMin: 0, rangeMax: 9 }
      : { title: 'Trace', description: 'Trace.', gradeBand: 'K', challenges: [{ id: 'c1', type: 'trace', digit: 3, showModel: false, showArrows: true }] }) }) as never);
}
const generate = async (patch: Record<string, unknown> = {}, learningObservations: unknown = signed) =>
  (await withGenerationRequest({ authorization: 'Bearer owner', learningObservations }, () => generateComponentContent({ ...item, config: { ...item.config, ...patch } } as never,
    'Missing numbers to 10', 'Kindergarten')) as { data: NumberTracerData }).data;
const plannerPrompts = () => vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => c.startsWith('Select ONE'));

it('a saved observation reaches the real registry generator through the catalog declaration and stays private', async () => {
  stubEngines('contrast_gap_positions_in_one_run');
  const data = await generate();
  expect(fetch).not.toHaveBeenCalled();
  expect(plannerPrompts()).toHaveLength(1);
  expect(plannerPrompts()[0]).toContain(observation.id);
  expect(plannerPrompts()[0]).toContain('read the drawing as 7');
  expect(data.learningAdaptation).toMatchObject({ move: 'contrast_gap_positions_in_one_run', source: 'saved-observation' });
  expect(compiledGapPositionContrast(data.challenges).count).toBeGreaterThan(0);
  expect(JSON.stringify(data)).not.toMatch(new RegExp(`${observation.id}|follows the last shown`));
  const generationPrompts = vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => String(a.contents)).filter(c => !c.startsWith('Select ONE'));
  expect(generationPrompts.join('\n')).not.toMatch(new RegExp(`${observation.id}|follows the last shown`));
});

it('no delivery in a handwriting mode or without a packet; an abstention claims no origin', async () => {
  stubEngines('contrast_gap_positions_in_one_run');
  expect((await generate({ targetEvalMode: 'trace' })).learningAdaptation).toBeUndefined();
  expect(await generate({}, null)).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(0);
  stubEngines('abstain');
  expect(await generate()).not.toHaveProperty('learningAdaptation');
  expect(plannerPrompts()).toHaveLength(1);
});
