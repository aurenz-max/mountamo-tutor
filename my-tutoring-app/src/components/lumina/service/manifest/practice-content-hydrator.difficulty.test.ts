import { describe, it, expect, vi } from 'vitest';

const calls: { kind: string; config: any }[] = [];
vi.mock('../geminiService', () => ({
  normalizeGradeLevel: (g: string) => g,
  generateComponentContent: vi.fn(async (item: any) => {
    calls.push({ kind: 'visual', config: item.config });
    return { type: item.componentId, instanceId: item.instanceId, data: {} };
  }),
}));
vi.mock('../knowledge-check/gemini-knowledge-check', () => ({
  generateKnowledgeCheck: vi.fn(async (_t: string, _g: string, config: any) => {
    calls.push({ kind: 'kc', config });
    return [{ id: 'p', type: 'multiple_choice' }];
  }),
}));
vi.mock('../fitGate/fitGate', () => ({
  generateWithFitGate: async (_a: any, run: (n: string[]) => any) => ({ result: await run([]), verdict: null }),
}));

import { hydratePracticeManifest } from './practice-content-hydrator';

describe('Pulse tier reaches every generator', () => {
  it('visual and text problems get the engine tier as config.difficulty', async () => {
    const objective = { id: 'ss1', text: 'Add within 20', grade: '1' };
    await hydratePracticeManifest({
      topic: 't', gradeLevel: 'elementary',
      items: [
        { instanceId: 'v', problemText: 'x', difficulty: 'hard', objective,
          visualPrimitive: { componentId: 'ten-frame', intent: 'i', targetEvalMode: 'build' } },
        { instanceId: 's', problemText: 'x', difficulty: 'hard', objective,
          standardProblem: { problemType: 'multiple_choice', generationIntent: 'g', evalMode: 'analyze' } },
      ],
    } as any);
    expect(calls.find(c => c.kind === 'visual')!.config.difficulty).toBe('hard');
    expect(calls.find(c => c.kind === 'kc')!.config.difficulty).toBe('hard');
  });
});
