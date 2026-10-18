import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { generateBarModel } from './gemini-bar-model';
import { countsFor, makeOneRowSame, obeysOrder, validateDataset } from './barModelDataset';

const WEATHER = [
  { label: 'snowy days', emoji: '❄️' }, { label: 'sunny days', emoji: '☀️' }, { label: 'rainy days', emoji: '🌧️' },
];
const AXIS_REPLY = {
  categories: WEATHER,
  contexts: [
    { name: 'January', mostToFewest: ['snowy days', 'rainy days', 'sunny days'] },
    { name: 'July', mostToFewest: ['sunny days', 'rainy days', 'snowy days'] },
  ],
};

describe('validateDataset', () => {
  it('reports no request when fewer than two categories come back', () => {
    expect(validateDataset({ categories: [WEATHER[0]], contexts: AXIS_REPLY.contexts }))
      .toEqual({ categories: [], contexts: [] });
  });

  it('keeps an order only when it ranks exactly the categories', () => {
    const out = validateDataset({ categories: WEATHER, contexts: [
      { name: 'January', mostToFewest: ['Snowy Days', 'rainy days', 'sunny days'] },
      { name: 'July', mostToFewest: ['sunny days', 'windy days', 'snowy days'] },
    ] });
    expect(out.contexts[0].order).toEqual(['snowy days', 'rainy days', 'sunny days']);
    expect(out.contexts[1].order).toEqual([]);
  });

  it('drops word emoji and duplicate labels', () => {
    const out = validateDataset({ categories: [...WEATHER, { label: 'Snowy days', emoji: '⛄' }, { label: 'windy days', emoji: 'wind' }], contexts: [] });
    expect(out.categories.map((c) => c.label)).toEqual(['snowy days', 'sunny days', 'rainy days']);
  });
});

describe('counts', () => {
  const labels = WEATHER.map((c) => c.label);
  it('ranks counts as the order says, every time', () => {
    for (let i = 0; i < 50; i++) {
      const counts = countsFor(labels, AXIS_REPLY.contexts[0].mostToFewest, 1, 9);
      expect(obeysOrder(labels, counts, AXIS_REPLY.contexts[0].mostToFewest)).toBe(true);
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...counts)).toBeLessThanOrEqual(9);
    }
  });

  it('makes one row the same only when both orders still hold', () => {
    const second = [1, 9, 5];
    const row = makeOneRowSame(labels, [9, 1, 5], second, ['sunny days', 'rainy days', 'snowy days'], 0);
    expect(row).toBe(2);
    expect(second).toEqual([1, 9, 5]);
    expect(makeOneRowSame(labels, [9, 1, 5], [1, 9, 4], ['sunny days', 'rainy days', 'snowy days'], 0)).toBe(2);
    expect(makeOneRowSame(labels, [9, 2, 1], [1, 9, 5], ['sunny days', 'rainy days', 'snowy days'], 0)).toBeNull();
  });
});

const ctx = (mode: string, scope: GenerationContext['scope']): GenerationContext => ({
  topic: scope.topic, grade: 'K', gradeLevel: 'Kindergarten', gradeContext: 'Kindergarten',
  objective: { text: scope.objectiveText }, scope, raw: { targetEvalMode: mode },
} as unknown as GenerationContext);

const WEATHER_SCOPE = {
  topic: 'Our Weather Graphs',
  objectiveText: 'Compare weather patterns between different locations and times using simple graphs and charts',
  intent: 'Kindergarten weather picture graphs for two months.',
};

const isAxisCall = (contents: unknown) => String(contents).startsWith('A picture graph is being generated');

describe('bar-model with the dataset axis', () => {
  beforeEach(() => { vi.mocked(ai.models.generateContent).mockReset(); });

  it('compares the lesson\'s months, with counts ranked as each month ranks them', async () => {
    vi.mocked(ai.models.generateContent).mockImplementation((async (args: { contents?: unknown }) => {
      if (isAxisCall(args.contents)) return { text: JSON.stringify(AXIS_REPLY) };
      throw new Error(`unexpected call: ${String(args.contents).slice(0, 60)}`);
    }) as never);
    const data = await generateBarModel(ctx('compare_two_graphs', WEATHER_SCOPE));
    expect(data.challenges.length).toBeGreaterThan(0);
    for (const c of data.challenges) {
      expect([c.graphLabel, c.secondGraphLabel].sort()).toEqual(['January', 'July']);
      expect(c.values.map((v) => v.label)).toEqual(WEATHER.map((w) => w.label));
      const order = (name?: string) => AXIS_REPLY.contexts.find((x) => x.name === name)!.mostToFewest;
      const labels = c.values.map((v) => v.label);
      expect(obeysOrder(labels, c.values.map((v) => v.value), order(c.graphLabel))).toBe(true);
      expect(obeysOrder(labels, c.secondValues!.map((v) => v.value), order(c.secondGraphLabel))).toBe(true);
      // The focus the tutor is told must be true of the pair.
      const same = c.values.some((v, i) => v.value === c.secondValues![i].value);
      const differ = c.values.some((v, i) => v.value !== c.secondValues![i].value);
      expect(c.comparisonFocus === 'same' ? same : differ).toBe(true);
      expect(c.prompt).toContain('January');
    }
  });

  it('keeps the survey pool when the lesson names nothing to graph', async () => {
    vi.mocked(ai.models.generateContent).mockImplementation((async (args: { contents?: unknown }) => {
      if (isAxisCall(args.contents)) return { text: JSON.stringify({ categories: [], contexts: [] }) };
      return { text: JSON.stringify({ cat0Label: 'Dogs', cat0Emoji: '🐶', cat1Label: 'Cats', cat1Emoji: '🐱', cat2Label: 'Fish', cat2Emoji: '🐟' }) };
    }) as never);
    const data = await generateBarModel(ctx('compare_two_graphs', {
      topic: 'Comparing graphs', objectiveText: 'Compare two picture graphs and tell what is the same and different', intent: 'K picture graphs',
    }));
    for (const c of data.challenges) {
      expect(c.graphLabel).toBe('Morning');
      expect(c.secondGraphLabel).toBe('Afternoon');
    }
  });

  it('makes no axis call for a mode the axis does not serve', async () => {
    vi.mocked(ai.models.generateContent).mockImplementation((async (args: { contents?: unknown }) => {
      if (isAxisCall(args.contents)) throw new Error('axis called');
      return { text: JSON.stringify({ title: 'Pets', description: 'Count.', cat0Label: 'Dogs', cat0Emoji: '🐶', cat1Label: 'Cats', cat1Emoji: '🐱', cat2Label: 'Fish', cat2Emoji: '🐟', prompt: 'Which has the most?' }) };
    }) as never);
    await generateBarModel(ctx('most_least', WEATHER_SCOPE));
    expect(vi.mocked(ai.models.generateContent).mock.calls.some(([a]) => isAxisCall((a as { contents?: unknown }).contents))).toBe(false);
  });

  it('make_graph builds with the lesson\'s categories', async () => {
    vi.mocked(ai.models.generateContent).mockImplementation((async (args: { contents?: unknown }) => {
      if (isAxisCall(args.contents)) return { text: JSON.stringify(AXIS_REPLY) };
      return { text: JSON.stringify({ themes: ['toys'], title: 'Our Weather', description: 'Make the weather graph.' }) };
    }) as never);
    const data = await generateBarModel(ctx('make_graph', WEATHER_SCOPE));
    for (const c of data.challenges) {
      for (const v of c.values) expect(WEATHER.map((w) => w.label)).toContain(v.label);
    }
  });
});
