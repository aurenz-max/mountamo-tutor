import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateMathFactFluency } from './gemini-math-fact-fluency';

const generateContent = vi.mocked(ai.models.generateContent);

/** The K atlas draw of OPS001-02-F: every item hides the minuend, at the easy tier,
 *  whose declared preference is the count-on position. */
function allStartUnknown(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    type: 'missing-number',
    instruction: 'Find the missing number.',
    equation: `${8 - i} - ${2} = ${6 - i}`,
    operation: 'subtraction',
    operand1: 8 - i,
    operand2: 2,
    result: 6 - i,
    unknownPosition: 'operand1',
    correctAnswer: 8 - i,
  }));
}

function contextFor(difficulty: string): GenerationContext {
  return {
    componentId: 'math-fact-fluency',
    instanceId: 'math-fact-fluency-test',
    topic: 'Find missing numbers in subtraction equations within 10 (missing difference or minuend)',
    gradeLevel: 'kindergarten',
    gradeContext: 'Kindergarten students',
    grade: 'K',
    intent: 'Find missing numbers in subtraction equations within 10',
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'missing_number',
    raw: { targetEvalMode: 'missing_number', difficulty },
  } as GenerationContext;
}

async function run(difficulty: string, items = 6) {
  generateContent.mockResolvedValue({
    text: JSON.stringify({
      title: 'Missing Numbers',
      description: 'Find what is missing.',
      maxNumber: 10,
      includeSubtraction: true,
      showVisualAids: false,
      targetResponseTime: 3,
      adaptiveDifficulty: true,
      gradeBand: 'K',
      challenges: allStartUnknown(items),
    }),
  } as never);
  return generateMathFactFluency(contextFor(difficulty));
}

describe('MathFactFluency missing-number unknown position', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('holds both forms at the easy tier even when every returned item is start-unknown', async () => {
    const data = await run('easy');
    const positions = data.challenges.map((c) => c.unknownPosition);

    // The finding: sixteen of sixteen probed easy items came back operand1.
    expect(positions).toContain('operand2');
    expect(positions).toContain('operand1');
    // The declared preference leads, then the session alternates.
    expect(positions[0]).toBe('operand2');
    expect(positions[1]).toBe('operand1');
    expect(positions).not.toContain('result');
  });

  it('keeps every equation true and every key on the blank it reassigned', async () => {
    const data = await run('easy');
    for (const ch of data.challenges) {
      expect(ch.operand1 - ch.operand2).toBe(ch.result);
      expect([ch.operand1, ch.operand2, ch.result].every((n) => n >= 0 && n <= 10)).toBe(true);
      const key = ch.unknownPosition === 'operand1' ? ch.operand1 : ch.operand2;
      expect(ch.correctAnswer).toBe(key);
    }
  });

  it('keeps the hard tier on start-unknown throughout', async () => {
    const data = await run('hard');
    expect(data.challenges.map((c) => c.unknownPosition)).toEqual(
      data.challenges.map(() => 'operand1'),
    );
  });
});
