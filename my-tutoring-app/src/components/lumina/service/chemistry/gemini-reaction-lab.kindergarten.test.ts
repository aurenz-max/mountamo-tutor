/** RXL-K1: no chemical/physical classification (or 6-8 types) for a kindergartner. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent } } }));

import { generateReactionLab, isKindergartenReaction } from './gemini-reaction-lab';

const ctx = (grade: string | undefined, gradeLevel: string, targetEvalMode?: string): GenerationContext => ({
  componentId: 'reaction-lab', instanceId: 't', topic: 'Mixing materials', gradeLevel,
  gradeContext: 'kindergarten students (ages 5-6)', grade, intent: 'Explore simple combinations of materials',
  objective: {}, scope: {} as GenerationContext['scope'], targetEvalMode, raw: {},
});
const opts = [{ id: 'A', text: 'The colors swirled' }, { id: 'B', text: 'It froze' }, { id: 'C', text: 'Nothing' }];
// The saved K observe draw (science-k-2026-10-17 evidence): observe, identify_signs, then classify.
const SAVED = {
  title: 'Soap and Milk', gradeBand: 'K-2',
  challenges: [
    { id: 'c1', type: 'observe', instruction: 'What happened to the colors?', options: opts, correctOptionId: 'A', targetAnswer: 'The colors swirled' },
    { id: 'c2', type: 'identify_signs', instruction: 'Which sign did you see?', options: opts, correctOptionId: 'A', targetAnswer: 'The colors swirled' },
    { id: 'c3', type: 'classify', instruction: 'Was mixing the soap into the milk a physical change or a chemical change?', options: null, targetAnswer: 'physical' },
  ],
};

describe('reaction-lab at kindergarten', () => {
  beforeEach(() => { generateContent.mockReset(); generateContent.mockResolvedValue({ text: JSON.stringify(SAVED) }); });

  it('drops the classify item from the observe mode and keeps the rest', async () => {
    const data = await generateReactionLab(ctx('K', 'kindergarten', 'observe'));
    expect(data.challenges.map((c) => c.type)).toEqual(['observe', 'identify_signs']);
    const prompt = String(generateContent.mock.calls[0][0].contents);
    expect(prompt).toContain('KINDERGARTEN RULES');
  });

  it('keeps classify at grade 2, where the chemical/physical distinction is taught', async () => {
    const data = await generateReactionLab(ctx('2', 'elementary', 'observe'));
    expect(data.challenges.map((c) => c.type)).toContain('classify');
    expect(String(generateContent.mock.calls[0][0].contents)).not.toContain('KINDERGARTEN RULES');
  });

  it('resolves K from the canonical grade first, then the grade key', () => {
    expect(isKindergartenReaction('K', 'elementary')).toBe(true);
    expect(isKindergartenReaction('1', 'kindergarten')).toBe(false);
    expect(isKindergartenReaction(undefined, 'kindergarten')).toBe(true);
  });
});
