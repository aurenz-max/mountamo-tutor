import { expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateNumberLine } from './gemini-number-line';

it.each(['add', 'subtract'] as const)('constrains every easy and chained hard jump to resolved %s intent', async (operation) => {
  vi.mocked(ai.models.generateContent).mockImplementation(async (request: any) => ({ text: JSON.stringify(
    request.config?.responseSchema?.properties?.jumpOperation
      ? { min: 0, max: 10, hasExplicitRange: true, hasFocusWindow: false, requiresExactMissingNumber: false, jumpOperation: operation }
      : { title: 'Number line', description: 'Practice jumps', instruction: '', hint: '' }),
  }) as any);
  for (const difficulty of ['easy', 'hard']) {
    const ctx: GenerationContext = { componentId: 'number-line', instanceId: 'operation-test', topic: 'Numbers within 10',
      intent: `Only ${operation}`, grade: '1', gradeLevel: 'elementary', gradeContext: 'Grade 1',
      objective: {}, scope: { topic: 'Numbers within 10' }, raw: { targetEvalMode: 'jump', difficulty },
    };
    for (let run = 0; run < 5; run++) {
      const data = await generateNumberLine(ctx);
      expect(data.challenges!.length).toBeGreaterThan(0);
      for (const challenge of data.challenges!) {
        for (const [index, op] of Array.from(challenge.operations!.entries())) {
          expect(op.type).toBe(operation);
          const landing = op.startValue + (operation === 'add' ? op.changeValue : -op.changeValue);
          expect(landing).toBe(challenge.targetValues[index]);
          expect(landing).toBeGreaterThanOrEqual(0);
          expect(landing).toBeLessThanOrEqual(10);
        }
      }
    }
  }
});
