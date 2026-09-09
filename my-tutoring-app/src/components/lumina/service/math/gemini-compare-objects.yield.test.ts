import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateCompareObjects } from './gemini-compare-objects';

const generateContent = vi.mocked(ai.models.generateContent);

const PAIRS: [string, string, string][] = [
  ['pencil', 'crayon', 'length'],
  ['book', 'feather', 'weight'],
  ['lamp', 'chair', 'height'],
  ['mug', 'bucket', 'capacity'],
  ['ribbon', 'straw', 'length'],
  ['stone', 'leaf', 'weight'],
  ['bottle', 'teapot', 'capacity'],
];

/** Valid raw items — real nouns, no size adjective, menus that never pair length+height. */
function draw(n: number, offset = 0) {
  const menus: Record<string, string[]> = {
    length: ['length', 'weight', 'capacity'],
    weight: ['weight', 'capacity', 'length'],
    height: ['height', 'weight', 'capacity'],
    capacity: ['capacity', 'weight', 'height'],
  };
  return {
    text: JSON.stringify({
      title: 'Measure It',
      description: 'What can we measure?',
      gradeBand: 'K',
      challenges: Array.from({ length: n }, (_, i) => {
        const [a, b, attribute] = PAIRS[(i + offset) % PAIRS.length];
        const [o0, o1, o2] = menus[attribute];
        return {
          id: `ia${i + 1}`,
          instruction: 'What can we measure about these two?',
          attribute,
          hint: 'Look at both of them carefully.',
          obj0Name: a, obj0VisualSize: 30, obj0ActualValue: 8,
          obj1Name: b, obj1VisualSize: 70, obj1ActualValue: 20,
          correctAttribute: attribute,
          attrOption0: o0, attrOption1: o1, attrOption2: o2,
        };
      }),
    }),
  } as never;
}

function context(): GenerationContext {
  return {
    componentId: 'compare-objects',
    instanceId: 'compare-objects-test',
    topic: 'Identify and describe basic measurable attributes (length, weight, size) of single objects using appropriate vocabulary',
    gradeLevel: 'kindergarten',
    gradeContext: 'Kindergarten students',
    grade: 'K',
    intent: 'Identify and describe basic measurable attributes of single objects',
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'identify_attribute',
    raw: { targetEvalMode: 'identify_attribute', difficulty: 'easy' },
  } as GenerationContext;
}

describe('CompareObjects identify_attribute yield', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('redraws once when a draw comes back under the session floor', async () => {
    // The MEAS001-01-A finding: the model returned two of the seven asked.
    generateContent.mockResolvedValueOnce(draw(2)).mockResolvedValueOnce(draw(5, 2));

    const data = await generateCompareObjects(context());

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
    // The two draws are merged on the object pair, never doubled up.
    const pairs = data.challenges.map((c) => c.objects.map((o) => o.name).sort().join('|'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('asks for more than it ships and takes no second draw when the first is full', async () => {
    generateContent.mockResolvedValue(draw(9));

    const data = await generateCompareObjects(context());

    expect(generateContent).toHaveBeenCalledTimes(1);
    const asked = String(generateContent.mock.calls[0][0].contents);
    expect(asked).toContain('Create 9 "identify the measurable attribute" challenges');
    expect(data.challenges.length).toBe(7);
  });
});
