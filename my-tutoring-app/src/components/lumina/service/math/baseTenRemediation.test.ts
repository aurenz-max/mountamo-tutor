import { expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateBaseTenBlocks } from './gemini-base-ten-blocks';
import { compiledBlockWorthContrast, selectBlockWorthContrast } from './baseTenRemediation';
import type { GenerationContext } from '../generation/generationContext';
import type { BaseTenBlocksChallenge } from '../../primitives/visual-primitives/math/BaseTenBlocks';
import { readCount, readWorthWord } from '../../primitives/visual-primitives/math/baseTenModel';
const focus = 'The student gives the bare digit for its worth regardless of position.';
const challenges = [2305, 5406, 6708].map(targetNumber => ({ type: 'read_blocks', targetNumber,
  instruction: 'Read the blocks.', hint: 'Look carefully.', showColumnCounts: false, showBlocksTotal: false } as BaseTenBlocksChallenge));
const request = { grade: '4', mode: 'read_blocks', tier: 'medium', topic: 'Place value in four-digit whole numbers', focus };
it('causally targets a count across two block sizes without changing shape, count, scripts or answers', () => {
  expect(compiledBlockWorthContrast(challenges).count).toBe(0);
  expect(selectBlockWorthContrast(challenges, null).challenges).toBe(challenges);
  const result = selectBlockWorthContrast(challenges, 'contrast_block_count_and_worth');
  expect(result.status).toBe('targeted'); expect(result.count).toBe(2);
  expect(result.challenges).not.toEqual(challenges);
  expect(result.challenges).toHaveLength(challenges.length);
  result.challenges.forEach((c, i) => {
    expect(String(c.targetNumber).replace(/[1-9]/g, 'x')).toBe(String(challenges[i].targetNumber).replace(/[1-9]/g, 'x'));
    expect({ ...c, targetNumber: 0 }).toEqual({ ...challenges[i], targetNumber: 0 });
  });
  const [a,b] = result.targets;
  expect(readCount(a.problem)).toBe(readCount(b.problem));
  expect(readWorthWord(a.problem)).not.toBe(readWorthWord(b.problem));
  expect(selectBlockWorthContrast(result.challenges, 'contrast_block_count_and_worth').status).toBe('already-targeted');
  expect(selectBlockWorthContrast(challenges.slice(0,1), 'contrast_block_count_and_worth').status).toBe('insufficient-capacity');
  expect(selectBlockWorthContrast(challenges, 'contrast_block_count_and_worth', { min: 2305, max: 2305 }).status).toBe('insufficient-capacity');
});
it('real generator consumes focus after structural selection and never sends it to the wrapper model', async () => {
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE') ? { move: 'contrast_block_count_and_worth', observationIds: ['active-observation'] } : { title: 'Read the blocks',
    description: 'Look at the mat.', numberValue: 2305, gradeBand: '4-5', maxPlace: 'thousands',
    interactionMode: 'decompose', challenges }) }) as never);
  const ctx = { componentId: 'base-ten-blocks', instanceId: 'probe', topic: request.topic, grade: '4', gradeLevel: '4',
    gradeContext: 'Grade 4', objective: {}, scope: { topic: request.topic }, raw: { targetEvalMode: 'read_blocks', difficulty: 'medium' } } as GenerationContext;
  const baseline = await generateBaseTenBlocks(ctx);
  const result = await generateBaseTenBlocks({ ...ctx, remediationFocus: focus });
  expect(baseline.learningAdaptation).toBeUndefined();
  expect(result.learningAdaptation).toMatchObject({ move: 'contrast_block_count_and_worth', comparisonCount: 2 });
  expect(result.challenges).not.toEqual(baseline.challenges);
  expect(result.supportTier).toBe('medium');
  expect(result.challenges!.every(c => c.type === 'read_blocks' && !c.showColumnCounts && !c.showBlocksTotal)).toBe(true);
  expect(JSON.stringify(vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => !String(a.contents).startsWith('Select ONE')))).not.toContain(focus);
  expect(JSON.stringify(result)).not.toMatch(/bare digit|remediationFocus|misconceptionOpportunity/);
  const anchored = await generateBaseTenBlocks({ ...ctx, remediationFocus: focus, objective: { text: 'Use 2345' } });
  expect(anchored.learningAdaptation).toBeUndefined();
});
it('a Grade 4 draw the model labels 2-3 keeps the code-owned 4-5 band, and the validated move still executes', async () => {
  // Live probe draws came back gradeBand '2-3' over four-digit numbers; the old band gate then dropped the move silently.
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move: 'contrast_block_count_and_worth', observationIds: ['active-observation'] }
    : { title: 'Read the blocks', description: 'Look at the mat.', numberValue: 2305, gradeBand: '2-3', maxPlace: 'thousands',
      interactionMode: 'decompose', challenges }) }) as never);
  const ctx = { componentId: 'base-ten-blocks', instanceId: 'probe', topic: request.topic, grade: '4', gradeLevel: '4',
    gradeContext: 'Grade 4', objective: {}, scope: { topic: request.topic }, raw: { targetEvalMode: 'read_blocks', difficulty: 'medium' } } as GenerationContext;
  const result = await generateBaseTenBlocks({ ...ctx, remediationFocus: focus });
  expect(result.gradeBand).toBe('4-5');
  expect(result.numberValue).toBe(2305);
  expect(result.learningAdaptation).toMatchObject({ move: 'contrast_block_count_and_worth', status: 'targeted', comparisonCount: 2 });
});
