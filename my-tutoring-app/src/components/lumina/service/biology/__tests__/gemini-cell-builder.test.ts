import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../../generation/generationContext';

const generateContent = vi.hoisted(() => vi.fn());

vi.mock('../../geminiClient', () => ({
  ai: { models: { generateContent } },
}));

import { generateCellBuilder } from '../gemini-cell-builder';

const payload = {
  challengeType: 'cell_inventory',
  title: 'Muscle Cell Mission',
  description: 'Build a working muscle cell.',
  cellType: 'animal',
  cellContext: 'muscle cell',
  gradeBand: '6-8',
  cellMembrane: { description: 'Flexible boundary', function: 'Controls exchange' },
  cellWall: { present: false, description: null },
  organelles: [
    {
      id: 'nucleus',
      name: 'Nucleus',
      function: 'Stores DNA',
      analogy: 'Mission control',
      uniqueTo: null,
      belongsInCell: true,
      correctZone: 'center',
      sizeRelative: 'large',
      expectedQuantity: 'few',
      quantityReasoning: 'One nucleus coordinates the cell.',
    },
  ],
  functionMatches: [
    { organelleId: 'nucleus', functionDescription: 'Holds instructions and coordinates activity.' },
  ],
};

function context(targetEvalMode?: string): GenerationContext {
  return {
    componentId: 'cell-builder',
    instanceId: 'cell-builder-test',
    topic: 'muscle cell',
    gradeLevel: '6',
    gradeContext: '6',
    grade: '6',
    intent: targetEvalMode ? `Practice ${targetEvalMode}` : undefined,
    objective: { text: targetEvalMode ? `Practice ${targetEvalMode}` : undefined },
    scope: {} as GenerationContext['scope'],
    targetEvalMode,
    raw: {},
  };
}

describe('generateCellBuilder eval-mode contract', () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({ text: JSON.stringify(payload) });
  });

  for (const mode of [
    'cell_inventory',
    'organelle_placement',
    'structure_function',
    'cell_specialization',
  ] as const) {
    it(`schema-pins and stamps ${mode}`, async () => {
      const result = await generateCellBuilder(context(mode));
      const request = generateContent.mock.calls[0][0];
      const schema = request.config.responseSchema;

      expect(schema.properties.challengeType.enum).toEqual([mode]);
      expect(result.challengeType).toBe(mode);
      expect(result.challengeTypes).toEqual([mode]);
    });
  }

  it('keeps all task identities on the unpinned mixed path', async () => {
    const result = await generateCellBuilder(context());
    const schema = generateContent.mock.calls[0][0].config.responseSchema;

    expect(schema.properties.challengeType.enum).toEqual([
      'cell_inventory',
      'organelle_placement',
      'structure_function',
      'cell_specialization',
    ]);
    expect(result.challengeTypes).toEqual([
      'cell_inventory',
      'organelle_placement',
      'structure_function',
      'cell_specialization',
    ]);
  });

  it('unions a curated explicit blend without admitting unrelated task identities', async () => {
    const result = await generateCellBuilder(context('cell_inventory|structure_function'));
    const schema = generateContent.mock.calls[0][0].config.responseSchema;

    expect(schema.properties.challengeType.enum).toEqual([
      'cell_inventory',
      'structure_function',
    ]);
    expect(result.challengeTypes).toEqual([
      'cell_inventory',
      'structure_function',
    ]);
  });
});
