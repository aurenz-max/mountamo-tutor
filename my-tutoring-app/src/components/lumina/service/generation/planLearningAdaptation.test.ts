import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { planLearningAdaptation } from './planLearningAdaptation';
import { placeValueTeaching, baseTenTeaching, eligiblePlaceValueTeaching, eligibleBaseTenTeaching } from '../math/placeValueTeachingCapabilities';
import { selectPlaceValueContrast, placeValueRemediationMoveFor } from '../math/placeValueRemediation';

const observation = { id: 'o1', summary: 'The learner treats a written numeral as having a fixed contribution even when it is relocated to another column.' };
const task = { grade: '4', mode: 'compare', tier: 'medium', objectiveText: 'Identify positional quantities in whole numbers' };
afterEach(() => vi.clearAllMocks());
it('lets the model interpret a paraphrase the old recognizer cannot match, then executes the validated move', async () => {
  expect(placeValueRemediationMoveFor('compare', 'medium', observation.summary)).toBeNull();
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ move: 'contrast_digit_worth', observationIds: ['o1'] }) } as never);
  const move = await planLearningAdaptation(placeValueTeaching, task, [observation]);
  const baseline = [2345, 6789, 7526].map((targetNumber, i) => ({ id: String(i), targetNumber, highlightedDigitPlace: 1 }));
  const selected = selectPlaceValueContrast(baseline, move);
  expect(selected.count).toBe(2);
  expect(selected.challenges).not.toEqual(baseline);
  expect(selected.challenges).toHaveLength(baseline.length);
  const prompt = String(vi.mocked(ai.models.generateContent).mock.calls[0][0].contents);
  expect(prompt).toContain(observation.summary);
  expect(prompt).toContain(task.objectiveText);
  expect(prompt).toContain(placeValueTeaching.task);
});
it.each([
  { move: 'abstain', observationIds: [] },
  { move: 'invented-move', observationIds: ['o1'] },
  { move: 'contrast_digit_worth', observationIds: ['unknown'] },
  { move: 'contrast_digit_worth', observationIds: [] },
  { move: 'contrast_digit_worth', observationIds: ['o1'], difficulty: 'hard' },
  null,
])('rejects unsupported or malformed decisions: %j', async raw => {
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify(raw) } as never);
  expect(await planLearningAdaptation(placeValueTeaching, task, [observation])).toBeNull();
});
it('uses the same planner for another capability with no source-primitive mapping', async () => {
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ move: 'contrast_block_count_and_worth', observationIds: ['o1'] }) } as never);
  expect(await planLearningAdaptation(baseTenTeaching, { ...task, mode: 'read_blocks' }, [observation])).toBe('contrast_block_count_and_worth');
  expect(await planLearningAdaptation(placeValueTeaching, task, [observation])).toBeNull();
});
it('abstains without a call for absent evidence and fails softly on model failure', async () => {
  expect(await planLearningAdaptation(placeValueTeaching, task, [])).toBeNull();
  expect(await planLearningAdaptation(placeValueTeaching, task, [{ ...observation, summary: ' ' }])).toBeNull();
  expect(ai.models.generateContent).not.toHaveBeenCalled();
  vi.mocked(ai.models.generateContent).mockRejectedValue(new Error('offline'));
  expect(await planLearningAdaptation(placeValueTeaching, task, [observation])).toBeNull();
});
it('gates executable task constraints independently of semantic relevance', () => {
  expect(eligiblePlaceValueTeaching(task)).toBe(true);
  for (const patch of [{ mode: 'build' }, { grade: '2' }, { tier: 'hard' }, { topic: 'Use 3456' }, { objectiveText: 'Three-digit numbers' }])
    expect(eligiblePlaceValueTeaching({ ...task, ...patch })).toBe(false);
  expect(eligibleBaseTenTeaching({ ...task, mode: 'read_blocks' })).toBe(true);
  expect(eligibleBaseTenTeaching({ ...task, mode: 'read_blocks', grade: '3' })).toBe(false);
});
