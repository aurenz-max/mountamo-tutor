import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateCountingBoard } from './gemini-counting-board';

const ctx = { componentId: 'counting-board', instanceId: 'test', topic: 'Quick look', grade: '1', gradeLevel: 'elementary',
  gradeContext: 'Grade 1', intent: 'Say how many at a glance', objective: { text: 'Recognize small sets without counting.' },
  scope: { topic: 'Counting' }, targetEvalMode: 'subitize', raw: { targetEvalMode: 'subitize' } } as GenerationContext;

/** The model's subitize boards with the given instructions; code owns the rest. */
async function generate(instructions: string[]) {
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ title: 'Quick look', description: 'Subitize.',
    objects: { type: 'stars' }, gradeBand: '1',
    showOptions: { showRunningCount: false, showGroupCircles: false, highlightOnTap: true, showLastNumber: true },
    challenges: instructions.map((instruction, i) => ({ id: `c${i + 1}`, type: 'subitize', instruction, targetAnswer: 4,
      count: 4, arrangement: 'scattered', hint: 'Look at the whole group.', narration: 'Look quick.' })) }) } as never);
  return generateCountingBoard(ctx);
}
afterEach(() => vi.clearAllMocks());

it('subitize: the prompt describes the spoken answer and the K flash, not a typed answer on visible objects', async () => {
  await generate(['How many stars did you see?']);
  const prompt = JSON.stringify(vi.mocked(ai.models.generateContent).mock.calls[0][0]);
  expect(prompt).not.toMatch(/types their answer|always visible/);
});

it('subitize: an instruction that sends the child to type, tap or count one by one is replaced by a spoken ask', async () => {
  const data = await generate([
    'Type how many stars you see!',
    'Tap each star to count them.',
    'Count them one by one, then tell me.',
    'How many stars did you see? Say it!',
    'Quick look! How many stars?',
  ]);
  const asks = data.challenges.map((c) => c.instruction);
  expect(asks.slice(0, 3)).toEqual(Array(3).fill('How many do you see right away?'));
  // Valid spoken asks are kept as the model wrote them.
  expect(asks.slice(3)).toEqual(['How many stars did you see? Say it!', 'Quick look! How many stars?']);
});
