import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateSortingStation } from './gemini-sorting-station';

const generateContent = vi.mocked(ai.models.generateContent);

const TEMPERATURE_OBJECTIVE =
  'Sort picture cards into temperature categories (hot, warm, cold) with real-world examples';

const namedSet = (categories: string[]) => ({
  text: JSON.stringify({ namesAnExplicitSet: categories.length > 0, categories }),
}) as never;

/** Distinct one-word names — the speakability gate drops anything a tutor cannot say.
 *  Each carries its OWN picture: the card gate rejects a set that gives different
 *  objects the same emoji, because a pre-reader cannot tell those cards apart. */
const NOUNS = [
  'Soup', 'Kettle', 'Bath', 'Sunshine', 'Snowball', 'Ice',
  'Cocoa', 'Puddle', 'Mitten', 'Toast', 'Sprinkler', 'Igloo',
];
const PICTURES = [
  '🍲', '🫖', '🛁', '☀️', '⛄', '🧊',
  '☕', '💧', '🧤', '🍞', '🚿', '🛖',
];

/** A sort draw whose objects only carry `values` — the bins are derived from them. */
const sortDraw = (challengeValues: string[][]) => {
  let n = 0;
  return {
    text: JSON.stringify({
      title: 'Hot and Cold',
      description: 'Sort the cards.',
      challenges: challengeValues.map((values, i) => ({
        instruction: `Sort these cards ${i + 1}.`,
        sortingAttribute: 'category',
        objects: values.map((value) => {
          const k = n++ % NOUNS.length;
          return { label: NOUNS[k], emoji: PICTURES[k], category: value };
        }),
      })),
    }),
  } as never;
};

function context(topic: string, difficulty = 'easy'): GenerationContext {
  return {
    componentId: 'sorting-station',
    instanceId: 'sorting-station-test',
    topic,
    gradeLevel: 'kindergarten',
    gradeContext: 'Kindergarten students',
    grade: 'K',
    intent: topic,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'sort_one',
    raw: { targetEvalMode: 'sort_one', difficulty },
  } as GenerationContext;
}

const promptWith = (fragment: string) =>
  generateContent.mock.calls
    .map((call) => String(call[0].contents))
    .filter((text) => text.includes(fragment));

describe('SortingStation named bins', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('lets the named set, not the easy tier, set the bin count', async () => {
    generateContent
      .mockResolvedValueOnce(namedSet(['hot', 'warm', 'cold']))
      .mockResolvedValueOnce(sortDraw([['hot', 'hot', 'warm', 'cold', 'cold', 'warm']]));

    await generateSortingStation(context(TEMPERATURE_OBJECTIVE));

    const [sortPrompt] = promptWith('TASK TYPE:');
    expect(sortPrompt).toContain('REQUIRED GROUPS');
    expect(sortPrompt).toContain('EXACTLY these 3 groups: hot, warm, cold');
    // The easy tier used to ask for "about 2 groups" over a three-group objective.
    expect(sortPrompt).not.toContain('about 2 groups');
    expect(sortPrompt).toContain('EXACTLY the 3 groups the objective names');
  });

  it('rejects a two-bin draw of a three-bin objective and redraws once', async () => {
    generateContent
      .mockResolvedValueOnce(namedSet(['hot', 'warm', 'cold']))
      // The K atlas draw 1: hot/cold in every challenge, warm gone.
      .mockResolvedValueOnce(sortDraw([['hot', 'hot', 'cold', 'cold'], ['hot', 'hot', 'cold', 'cold']]))
      .mockResolvedValueOnce(sortDraw([['hot', 'warm', 'cold', 'cold'], ['hot', 'hot', 'warm', 'cold']]));

    const data = await generateSortingStation(context(TEMPERATURE_OBJECTIVE));

    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(data.challenges.length).toBeGreaterThan(0);
    for (const ch of data.challenges) {
      const labels = (ch.categories ?? []).map((c) => c.label.toLowerCase());
      expect(labels).toContain('hot');
      expect(labels).toContain('warm');
      expect(labels).toContain('cold');
    }
  });

  /**
   * The 2026-09-08 K band-floor re-audit shipped a card labelled "Red Banana" carrying 🍓.
   * At the pre-reader band the picture IS the object, so that card has no answer by eye —
   * the exact demand the floor move assumed was gone. Draws come out clean most of the
   * time, which is why the gate is tested here rather than by taking more draws.
   */
  const mismatchedDraw = () => ({
    text: JSON.stringify({
      title: 'Fruit Sort',
      description: 'Sort the cards.',
      challenges: [{
        instruction: 'Sort these cards.',
        sortingAttribute: 'category',
        objects: [
          { label: 'Red Banana', emoji: '🍓', category: 'hot' },
          { label: 'Kettle', emoji: '🫖', category: 'hot' },
          { label: 'Snowball', emoji: '⛄', category: 'warm' },
          { label: 'Igloo', emoji: '🛖', category: 'cold' },
        ],
      }],
    }),
  }) as never;

  it('rejects a card whose picture is not the object its label names, and redraws', async () => {
    generateContent
      .mockResolvedValueOnce(namedSet(['hot', 'warm', 'cold']))
      .mockResolvedValueOnce(mismatchedDraw())
      .mockResolvedValueOnce(sortDraw([['hot', 'warm', 'cold', 'cold']]));

    const data = await generateSortingStation(context(TEMPERATURE_OBJECTIVE));

    expect(generateContent).toHaveBeenCalledTimes(3);
    // The clean redraw shipped; nothing from the mismatched set reached the child.
    expect(data.challenges.length).toBe(1);
    const labels = data.challenges.flatMap((ch) => ch.objects.map((o) => o.label));
    expect(labels).not.toContain('Red Banana');
  });

  it('keeps a label whose other word agrees with the picture', async () => {
    // "Red Apple" 🍎 and "Rain Hat" 👒 each carry a word that disagrees. Both stay:
    // one agreeing word is enough, or the gate would eat most real draws.
    const agreeingDraw = () => ({
      text: JSON.stringify({
        title: 'Sort',
        description: 'Sort the cards.',
        challenges: [{
          instruction: 'Sort these cards.',
          sortingAttribute: 'category',
          objects: [
            { label: 'Red Apple', emoji: '🍎', category: 'hot' },
            { label: 'Rain Hat', emoji: '👒', category: 'warm' },
            { label: 'Igloo', emoji: '🛖', category: 'cold' },
            { label: 'Kettle', emoji: '🫖', category: 'hot' },
          ],
        }],
      }),
    }) as never;

    generateContent
      .mockResolvedValueOnce(namedSet(['hot', 'warm', 'cold']))
      .mockResolvedValueOnce(agreeingDraw());

    const data = await generateSortingStation(context(TEMPERATURE_OBJECTIVE));

    expect(generateContent).toHaveBeenCalledTimes(2); // no redraw spent
    const labels = data.challenges.flatMap((ch) => ch.objects.map((o) => o.label));
    expect(labels).toContain('Red Apple');
    expect(labels).toContain('Rain Hat');
  });

  it('ships the draw rather than an empty lesson when two draws both miss a group', async () => {
    const twoBins = () => sortDraw([['hot', 'hot', 'cold', 'cold']]);
    generateContent
      .mockResolvedValueOnce(namedSet(['hot', 'warm', 'cold']))
      .mockResolvedValueOnce(twoBins())
      .mockResolvedValueOnce(twoBins());

    const data = await generateSortingStation(context(TEMPERATURE_OBJECTIVE));

    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(data.challenges.length).toBe(1);
  });

  it('does not let a named set push K past its band bin cap (contract R8)', async () => {
    generateContent
      .mockResolvedValueOnce(namedSet(['hot', 'warm', 'cool', 'cold']))
      .mockResolvedValueOnce(sortDraw([['hot', 'hot', 'cold', 'cold']]));

    const data = await generateSortingStation(context('Sort cards into hot, warm, cool and cold'));

    const [sortPrompt] = promptWith('TASK TYPE:');
    // Four groups is over the K cap of three, so the binding is dropped rather than
    // silently overriding a band contract — and the two-bin draw is not rejected for it.
    expect(sortPrompt).not.toContain('REQUIRED GROUPS');
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(data.challenges.length).toBe(1);
  });

  it('leaves an open objective to the tier, with no extra call spent on it', async () => {
    generateContent
      .mockResolvedValueOnce(namedSet([]))
      .mockResolvedValueOnce(sortDraw([['red', 'red', 'blue', 'blue']]));

    const data = await generateSortingStation(context('Sort classroom objects by color'));

    const [sortPrompt] = promptWith('TASK TYPE:');
    expect(sortPrompt).not.toContain('REQUIRED GROUPS');
    expect(sortPrompt).toContain('about 2 groups');
    expect(data.challenges.length).toBe(1);
    // No redraw: an open objective has no named group to be missing.
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
