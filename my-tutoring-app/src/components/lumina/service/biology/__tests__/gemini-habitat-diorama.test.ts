import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../../generation/generationContext';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('../../geminiClient', () => ({ ai: { models: { generateContent } } }));

import { ALL_HABITAT_CHALLENGE_TYPES, generateHabitatDiorama } from '../gemini-habitat-diorama';

const payload = {
  primitiveType: 'habitat-diorama',
  habitat: { name: 'Forest Web', biome: 'temperate forest', climate: 'cool and wet', description: 'A layered forest ecosystem.' },
  organisms: [
    { id: 'oak', commonName: 'Oak Tree', role: 'producer', imagePrompt: 'oak', position: { x: '15%', y: '30%' }, description: 'Makes food.', adaptations: ['broad leaves'] },
    { id: 'hare', commonName: 'Snowshoe Hare', role: 'primary-consumer', imagePrompt: 'hare', position: { x: '38%', y: '65%' }, description: 'Eats leaves.', adaptations: ['wide feet'] },
    { id: 'fox', commonName: 'Red Fox', role: 'secondary-consumer', imagePrompt: 'fox', position: { x: '62%', y: '55%' }, description: 'Hunts small animals.', adaptations: ['keen hearing'] },
    { id: 'fungus', commonName: 'Shelf Fungus', role: 'decomposer', imagePrompt: 'fungus', position: { x: '25%', y: '80%' }, description: 'Breaks down wood.', adaptations: ['enzymes'] },
    { id: 'beaver', commonName: 'River Beaver', role: 'primary-consumer', imagePrompt: 'beaver', position: { x: '84%', y: '68%' }, description: 'Builds dams.', adaptations: ['flat tail'] },
  ],
  relationships: [
    { fromId: 'oak', toId: 'hare', type: 'predation', description: 'Hare eats oak leaves.' },
    { fromId: 'hare', toId: 'fox', type: 'predation', description: 'Fox hunts hare.' },
    { fromId: 'fungus', toId: 'oak', type: 'symbiosis-commensalism', description: 'Fungus uses fallen wood.' },
    { fromId: 'oak', toId: 'beaver', type: 'predation', description: 'Beaver eats bark.' },
  ],
  environmentalFeatures: [
    { id: 'stream', name: 'Stream', description: 'Fresh water', position: { x: '75%', y: '75%' } },
    { id: 'soil', name: 'Forest Soil', description: 'Nutrient-rich ground', position: { x: '30%', y: '90%' } },
  ],
  challenges: [
    { id: 'o', type: 'observe', prompt: 'It captures sunlight and starts the food chain.', explanation: 'The oak supports consumers.', focusOrganismId: 'oak', optionOrganismIds: ['oak', 'hare', 'fox', 'fungus'] },
    { id: 'c', type: 'connect', prompt: 'Complete the hare feeding relationship.', explanation: 'The fox hunts the hare.', fromId: 'hare', toId: 'fox' },
    { id: 'p', type: 'predict', prompt: 'Trace the first response.', explanation: 'Fewer hunters let more hares survive.', disruptionEvent: 'The fox population becomes smaller.', affectedOrganismId: 'hare', expectedTrend: 'increase', optionOrganismIds: ['hare', 'oak', 'fungus', 'beaver'] },
    { id: 'r', type: 'restore', prompt: 'Return the decomposer to a viable layer.', explanation: 'Fallen wood collects near the soil.', restorationEntityId: 'fungus', restorationZone: 'ground' },
    { id: 'd', type: 'defend', prompt: 'The beaver changes habitat for other species', explanation: 'The dam redirects water.', evidenceChoices: [
      { id: 'dam', text: 'Its dam redirects flowing water into a pond.' },
      { id: 'fur', text: 'Its thick fur traps warm air near its skin.' },
      { id: 'teeth', text: 'Its orange front teeth keep growing.' },
    ], correctEvidenceId: 'dam' },
  ],
  gradeBand: '3-5',
};

const context = (targetEvalMode?: string): GenerationContext => ({
  componentId: 'habitat-diorama', instanceId: 'habitat-test', topic: 'forest food web',
  gradeLevel: '4', gradeContext: '4', grade: '4', intent: targetEvalMode ? `Practice ${targetEvalMode}` : undefined,
  objective: { text: targetEvalMode ? `Practice ${targetEvalMode}` : undefined }, scope: {} as GenerationContext['scope'],
  targetEvalMode, raw: {},
});

describe('generateHabitatDiorama eval-mode contract', () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({ text: JSON.stringify(payload) });
  });

  for (const mode of ALL_HABITAT_CHALLENGE_TYPES) {
    it(`schema-pins, filters, and stamps ${mode}`, async () => {
      const result = await generateHabitatDiorama(context(mode));
      const schema = generateContent.mock.calls[0][0].config.responseSchema;
      expect(schema.properties.challenges.items.properties.type.enum).toEqual([mode]);
      expect(result.challengeType).toBe(mode);
      expect(result.challengeTypes).toEqual([mode]);
      expect(result.challenges?.map((challenge) => challenge.type)).toEqual([mode]);
    });
  }

  it('keeps the full ladder on the unpinned mixed path', async () => {
    const result = await generateHabitatDiorama(context());
    const schema = generateContent.mock.calls[0][0].config.responseSchema;
    expect(schema.properties.challenges.items.properties.type.enum).toEqual(ALL_HABITAT_CHALLENGE_TYPES);
    expect(result.challengeTypes).toEqual(ALL_HABITAT_CHALLENGE_TYPES);
    expect(result.challenges).toHaveLength(5);
  });

  it('unions an explicit blend and removes unrelated identities', async () => {
    const result = await generateHabitatDiorama(context('observe|restore'));
    expect(result.challengeTypes).toEqual(['observe', 'restore']);
    expect(result.challenges?.map((challenge) => challenge.type)).toEqual(['observe', 'restore']);
  });
});
