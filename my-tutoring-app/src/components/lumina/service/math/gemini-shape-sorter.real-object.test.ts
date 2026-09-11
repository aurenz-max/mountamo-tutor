import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      title: 'Shapes Around Us',
      description: 'Look carefully and answer out loud.',
      gradeBand: 'K',
      challenges: [{
        id: 'objects',
        type: 'identify-real-object',
        instruction: 'Look and answer.',
        ruleAttribute: 'shape',
        targetValue: 'circle',
        shapes: [{ shape: 'circle', color: 'blue', size: 'large', rotation: 0 }],
      }],
    }),
  }),
}));

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import { generateShapeSorter } from './gemini-shape-sorter';
import type { GenerationContext } from '../generation/generationContext';
import {
  objectLabelLeaksShape,
  realWorldShapeObjectById,
} from '../../primitives/visual-primitives/shared/realWorldShapeObjects';

const context: GenerationContext = {
  componentId: 'shape-sorter',
  instanceId: 'shape-sorter-test',
  topic: 'Find shapes in real objects',
  gradeLevel: 'kindergarten',
  gradeContext: 'kindergarten',
  grade: 'K',
  intent: 'Identify 2D shapes in familiar objects',
  objective: { text: 'Recognize shapes in real-world objects' },
  scope: {
    topic: 'Find shapes in real objects',
    objectiveText: 'Recognize shapes in real-world objects',
    intent: 'Identify 2D shapes in familiar objects',
  },
  targetEvalMode: 'find_real_object',
  raw: {},
};

describe('generateShapeSorter real-object eval mode', () => {
  it('pins the schema and replaces model material with code-owned object truth', async () => {
    const data = await generateShapeSorter(context);
    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
    const call = mocks.generateContent.mock.calls[0][0];
    expect(call.config.responseSchema.properties.challenges.items.properties.type.enum)
      .toEqual(['identify-real-object']);

    expect(data.challenges).toHaveLength(1);
    expect(data.challenges[0].type).toBe('identify-real-object');
    expect(data.challenges[0].shapes).toHaveLength(4);
    for (const shape of data.challenges[0].shapes) {
      const object = realWorldShapeObjectById(shape.realObjectId);
      expect(object).toBeDefined();
      expect(shape.shape).toBe(object?.shape);
      expect(shape.realObject).toBe(object?.label);
      expect(objectLabelLeaksShape(shape.realObject ?? '')).toBe(false);
    }
  });
});

