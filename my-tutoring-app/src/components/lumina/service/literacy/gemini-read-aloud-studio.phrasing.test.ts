import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent } } }));
import { generateReadAloudStudio } from './gemini-read-aloud-studio';
import { studioItems } from '../../primitives/visual-primitives/literacy/readAloudPhrasing';

const line = { text: 'After the rain, the birds sang.', stressWord: 'sang', phraseGroups: ['After the rain,', 'the birds sang.'] };
const ctx = (raw: Record<string, unknown> = {}): GenerationContext => ({
  componentId: 'read-aloud-studio', instanceId: 'test', topic: 'A walk after the rain',
  grade: '3', gradeLevel: 'elementary', gradeContext: 'Grade 3', objective: {},
  scope: {} as GenerationContext['scope'], raw: { targetEvalMode: 'expression', ...raw },
});
beforeEach(() => { vi.clearAllMocks(); });
const respond = (overrides: Record<string, unknown> = {}) => generateContent.mockResolvedValue({ text: JSON.stringify({
  title: 'After the Rain', gradeLevel: '3', lexileLevel: '520L', fluencyFocus: 'expression', lines: [line], ...overrides,
}) });

describe('expression generation contract', () => {
  it('pins expression, binds exact phrase groups, and builds the three-step runtime', async () => {
    respond();
    const data = await generateReadAloudStudio(ctx());
    expect(data.lines[0].phraseGroups).toEqual(line.phraseGroups);
    expect(studioItems(data.lines, data.fluencyFocus!)).toHaveLength(3);
    const request = generateContent.mock.calls[0][0];
    expect(request.config.responseSchema.properties.fluencyFocus.enum).toEqual(['expression']);
    expect(request.contents).toContain('Keep determiners with nouns');
    expect(request.contents).toContain('first read');
  });
  it.each([undefined, [], ['After the rain,', 'birds sang.'], ['After', 'the', 'rain,', 'the birds sang.']])('refuses a generated plan with missing/mismatched groups: %j', async (phraseGroups) => {
    respond({ lines: [{ ...line, phraseGroups }] });
    await expect(generateReadAloudStudio(ctx())).rejects.toThrow('phraseGroups bound exactly');
  });
  it('does not let stale config replace validated text or the pinned mode', async () => {
    respond({ fluencyFocus: 'accuracy' });
    const data = await generateReadAloudStudio(ctx({ fluencyFocus: 'dialogue', lines: [{ text: 'Wrong payload' }] }));
    expect(data.fluencyFocus).toBe('expression');
    expect(data.lines).toEqual([line]);
  });
  it.each(['accuracy', 'dialogue'])('does not require phrase annotations for %s', async (targetEvalMode) => {
    respond({ fluencyFocus: targetEvalMode, lines: [{ text: 'We can go now.', ...(targetEvalMode === 'dialogue' ? { speaker: 'Mia' } : {}) }] });
    const data = await generateReadAloudStudio(ctx({ targetEvalMode }));
    expect(data.fluencyFocus).toBe(targetEvalMode);
    expect(studioItems(data.lines, data.fluencyFocus!)).toHaveLength(1);
  });
});
