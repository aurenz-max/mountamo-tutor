/** RP-4 (handoff 28): a model that writes the Unicode minus must not mis-key or lose a challenge. */
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));

import { ai } from '../geminiClient';
import { generateEquationBuilder } from './gemini-equation-builder';

const reply = (challenges: object[]) => {
  vi.mocked(ai.models.generateContent).mockResolvedValue({
    text: JSON.stringify({ title: 't', description: 'd', maxNumber: 10, gradeBand: '1', challenges }),
  } as never);
};
const generate = (mode: string) => generateEquationBuilder({
  topic: 'Subtraction within 10', gradeContext: 'Grade 1', scope: {}, raw: { targetEvalMode: mode },
} as never);

beforeEach(() => { vi.mocked(ai.models.generateContent).mockReset(); });

it('a true statement written with "−" is keyed True', async () => {
  reply([
    { id: 'c1', type: 'true-false', instruction: 'Is it true?', displayEquation: '8 − 3 = 5' },
    { id: 'c2', type: 'true-false', instruction: 'Is it true?', displayEquation: '9 – 4 = 6' },
  ]);
  const data = await generate('true-false');
  const byId = Object.fromEntries(data.challenges.map((c) => [c.id, c]));
  expect(byId.c1).toMatchObject({ displayEquation: '8 - 3 = 5', isTrue: true });
  expect(byId.c2).toMatchObject({ displayEquation: '9 - 4 = 6', isTrue: false });
});

it('a build target written with "−" survives, and its tiles use the minus the checker reads', async () => {
  reply([{ id: 'c1', type: 'build', instruction: 'Build a true equation', targetEquation: '8 − 3 = 5',
    tile0: '8', tile1: '−', tile2: '3', tile3: '=', tile4: '5', tile5: '4', tile6: '+' }]);
  const data = await generate('build-simple');
  const c = data.challenges.find((x) => x.id === 'c1')!;
  expect(c.targetEquation).toBe('8 - 3 = 5');
  expect(c.availableTiles).toContain('-');
  expect(c.availableTiles).not.toContain('−');
});
