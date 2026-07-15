import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateSortingStation } from './gemini-sorting-station';

const generateContent = vi.mocked(ai.models.generateContent);

function contextFor(targetEvalMode: string, topic: string, intent: string): GenerationContext {
  return {
    componentId: 'sorting-station',
    instanceId: 'sorting-station-test',
    topic,
    gradeLevel: 'kindergarten',
    gradeContext: 'Kindergarten students',
    grade: 'K',
    intent,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode,
    raw: { targetEvalMode },
  };
}

describe('SortingStation objective binding', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('threads the specific intent into sort-by-one and forbids attribute-variety drift', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'Needs and Wants',
        description: 'Sort by the lesson category.',
        challenges: [{
          instruction: 'Put each item with the needs or wants.',
          sortingAttribute: 'category',
          objects: [
            { label: 'Water', emoji: '💧', category: 'need' },
            { label: 'Food', emoji: '🍎', category: 'need' },
            { label: 'Toy', emoji: '🧸', category: 'want' },
            { label: 'Game', emoji: '🎲', category: 'want' },
          ],
        }],
      }),
    } as never);

    const intent = 'Drag familiar items into Need and Want groups';
    const result = await generateSortingStation(contextFor(
      'sort_one',
      'Sort basic items into categories of needs versus wants',
      intent,
    ));

    const prompt = String(generateContent.mock.calls[0][0].contents);
    expect(prompt).toContain(`Specific objective for THIS activity: "${intent}"`);
    expect(prompt).toContain('Keep the SAME taught classification rule across challenges');
    expect(prompt).toContain('NEVER by switching to an unrelated color/size/shape sort');
    expect(result.challenges[0].sortingAttribute).toBe('category');
    expect(result.challenges[0].categories?.map((category) => category.label)).toEqual(['Need', 'Want']);
  });

  it('makes the lesson category the primary rule in two-criterion mode', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'Find the Food Needs',
        description: 'Check the lesson group and one more clue.',
        challenges: [{
          instruction: 'Which needs are food?',
          targetCategory: 'need',
          secondaryAttribute: 'type',
          secondaryValue: 'food',
          categoryLabel: 'Food Needs',
          objects: [
            { label: 'Water', emoji: '💧', category: 'need', type: 'food' },
            { label: 'Shelter', emoji: '🏠', category: 'need', type: 'housing' },
            { label: 'Cupcake', emoji: '🧁', category: 'want', type: 'food' },
            { label: 'Toy', emoji: '🧸', category: 'want', type: 'fun' },
          ],
        }],
      }),
    } as never);

    const result = await generateSortingStation(contextFor(
      'two_attributes',
      'Sort basic items into categories of needs versus wants',
      'Find items that are needs using two relevant clues',
    ));

    expect(result.challenges[0].type).toBe('two-attributes');
    expect(result.challenges[0].sortingAttribute).toBe('category + type');
    expect(result.challenges[0].categories?.[0].rule).toEqual({
      category: 'need',
      type: 'food',
    });
    expect(result.challenges[0].objects.every((object) => object.attributes.category)).toBe(true);
  });
});
