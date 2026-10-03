import { describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import {
  ADDITION_FACT_STRATEGIES,
  buildAdditionFactSession,
  generateAdditionFactStrategies,
  sessionCount,
  strategyPool,
} from './gemini-addition-fact-strategies';

/** Deterministic mulberry32 RNG. */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const pairKey = (a: number, b: number) => (a <= b ? `${a}|${b}` : `${b}|${a}`);
const EXPECTED_COUNT: Record<string, number> = {
  plus_zero: 8, plus_one: 8, doubles: 8, turnaround: 8, plus_two: 8,
  facts_3_4: 8, facts_5_6: 8, facts_7_8: 6, facts_mixed: 10,
};

describe('buildAdditionFactSession', () => {
  for (const strategy of ADDITION_FACT_STRATEGIES) {
    it(`${strategy}: holds every session rule over 50 seeded runs`, () => {
      const pool = strategyPool(strategy);
      const poolOriented = new Set(pool.map(([a, b]) => `${a}+${b}`));
      const poolPairs = new Set(pool.map(([a, b]) => pairKey(a, b)));
      expect(sessionCount(strategy)).toBe(EXPECTED_COUNT[strategy]);

      for (let seed = 1; seed <= 50; seed++) {
        const { challenges, introExample } = buildAdditionFactSession(strategy, seeded(seed));
        expect(challenges).toHaveLength(EXPECTED_COUNT[strategy]);

        const keys = challenges.map((c) => `${c.a}+${c.b}`);
        expect(new Set(keys).size).toBe(keys.length);

        challenges.forEach((c, i) => {
          expect(c.id).toBe(`afs-${i + 1}`);
          expect(c.type).toBe(strategy);
          expect(c.sum).toBe(c.a + c.b);
          expect(Number.isInteger(c.a) && c.a >= 0 && c.a <= 9).toBe(true);
          expect(Number.isInteger(c.b) && c.b >= 0 && c.b <= 9).toBe(true);
          if (strategy === 'turnaround') {
            expect(poolPairs.has(pairKey(c.a, c.b))).toBe(true);
            expect(c.knownFact).toEqual({ a: c.b, b: c.a });
          } else {
            expect(poolOriented.has(`${c.a}+${c.b}`)).toBe(true);
            expect(c.knownFact).toBeUndefined();
          }
          if (i > 0) {
            const prev = challenges[i - 1];
            expect(pairKey(c.a, c.b)).not.toBe(pairKey(prev.a, prev.b));
          }
        });

        if (strategy === 'turnaround') {
          const pairs = challenges.map((c) => pairKey(c.a, c.b));
          expect(new Set(pairs).size).toBe(pairs.length);
        }

        if (['plus_zero', 'plus_one', 'plus_two'].includes(strategy)) {
          const special = strategy === 'plus_zero' ? 0 : strategy === 'plus_one' ? 1 : 2;
          expect(challenges.some((c) => c.a === special && c.b !== special)).toBe(true);
          expect(challenges.some((c) => c.b === special && c.a !== special)).toBe(true);
        }

        if (strategy === 'facts_mixed') {
          const lows = challenges.map((c) => Math.min(c.a, c.b));
          expect(lows.some((l) => l <= 4)).toBe(true);
          expect(lows.some((l) => l === 5 || l === 6)).toBe(true);
          expect(lows.some((l) => l >= 7)).toBe(true);
        }

        if (strategy.startsWith('facts_')) {
          expect(introExample).toBeUndefined();
        } else if (introExample) {
          const asked = new Set(challenges.map((c) => pairKey(c.a, c.b)));
          expect(asked.has(pairKey(introExample.a, introExample.b))).toBe(false);
          expect(poolPairs.has(pairKey(introExample.a, introExample.b))).toBe(true);
          if (strategy === 'turnaround') expect(introExample.a).not.toBe(introExample.b);
        }
        if (['plus_zero', 'plus_one', 'doubles', 'turnaround'].includes(strategy)) {
          expect(introExample).toBeDefined();
        }
      }
    });
  }
});

describe('generateAdditionFactStrategies', () => {
  const generateContent = vi.mocked(ai.models.generateContent);
  // The objective sum-window call runs before the wrapper call on every generation.
  const window = (maxNumber: number | null) =>
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitScope: maxNumber !== null, maxNumber: maxNumber ?? 18 }),
    } as never);

  it('honours a pinned strategy and replaces a leaking title and a bad emoji', async () => {
    window(null);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'What is 3 + 3?', description: 'Fun doubles.', strategy: 'plus_one', objectEmoji: 'apple' }),
    } as never);
    const data = await generateAdditionFactStrategies('Doubles', 'Grade 2', { strategy: 'doubles' });
    expect(data.strategy).toBe('doubles');
    expect(data.title).not.toMatch(/\d\s*\+\s*\d/);
    expect(data.objectEmoji).toBe('🌸');
    expect(data.gradeBand).toBe('2');
    expect(data.challenges).toHaveLength(8);
  });

  it('builds a valid session when Gemini fails', async () => {
    generateContent.mockRejectedValueOnce(new Error('boom'));
    generateContent.mockRejectedValueOnce(new Error('boom'));
    const data = await generateAdditionFactStrategies('Addition within 20', 'Grade 1');
    expect(data.strategy).toBe('facts_mixed');
    expect(data.title.length).toBeGreaterThan(0);
    expect(data.description.length).toBeGreaterThan(0);
    expect(data.objectEmoji).toBe('⭐');
    expect(data.challenges).toHaveLength(10);
    expect(data.gradeBand).toBe('1');
  });

  it('keeps a valid Gemini emoji and strategy', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ modes: ['turnaround'] }) } as never);
    window(null);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'Apple Orchard Turn-Arounds', description: 'Switch the order, keep the total.', strategy: 'turnaround', objectEmoji: '🍎' }),
    } as never);
    const data = await generateAdditionFactStrategies('Apples', 'Grade 1', { intent: 'commutative property' });
    expect(data.strategy).toBe('turnaround');
    expect(data.objectEmoji).toBe('🍎');
    expect(data.title).toBe('Apple Orchard Turn-Arounds');
    data.challenges.forEach((c) => expect(c.knownFact).toEqual({ a: c.b, b: c.a }));
  });

  it('a single-family mode pins the strategy and needs no resolver call', async () => {
    generateContent.mockReset();
    window(null);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'Bug Hill', description: 'One more each time.', strategy: 'doubles', objectEmoji: '🐞' }),
    } as never);
    const data = await generateAdditionFactStrategies('Bugs', 'Grade 1', { targetEvalMode: 'plus_one' });
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(data.strategy).toBe('plus_one');
    data.challenges.forEach((c) => expect(c.a === 1 || c.b === 1).toBe(true));
  });

  it('big_facts constrains the enum to the bands and lets the topic pick one', async () => {
    generateContent.mockReset();
    window(null);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'Rainbow Peak', description: 'The biggest facts.', strategy: 'facts_7_8', objectEmoji: '💎' }),
    } as never);
    const data = await generateAdditionFactStrategies('Facts with 7s and 8s', 'Grade 2', { targetEvalMode: 'big_facts' });
    const schema = (generateContent.mock.calls[1][0] as { config: { responseSchema: { properties: { strategy: { enum: string[] } } } } }).config.responseSchema;
    expect(schema.properties.strategy.enum).toEqual(['facts_3_4', 'facts_5_6', 'facts_7_8', 'facts_mixed']);
    expect(data.strategy).toBe('facts_7_8');
  });

  it('big_facts falls back to facts_mixed when Gemini picks outside the mode', async () => {
    generateContent.mockReset();
    window(null);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'Big Facts', description: 'Practice.', strategy: 'plus_zero', objectEmoji: '⭐' }),
    } as never);
    const data = await generateAdditionFactStrategies('Addition', 'Grade 2', { targetEvalMode: 'big_facts' });
    expect(data.strategy).toBe('facts_mixed');
  });

  it("a sum window keeps every fact inside the lesson's range and drops families that cannot fill it", async () => {
    generateContent.mockReset();
    window(10);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'Quick Facts', description: 'Practice.', strategy: 'facts_mixed', objectEmoji: '⭐' }),
    } as never);
    const data = await generateAdditionFactStrategies('Addition facts to 10', 'Grade 1', { strategy: undefined });
    const schema = (generateContent.mock.calls[1][0] as { config: { responseSchema: { properties: { strategy: { enum: string[] } } } } }).config.responseSchema;
    expect(schema.properties.strategy.enum).not.toContain('facts_7_8');
    expect(schema.properties.strategy.enum).not.toContain('facts_5_6');
    expect(data.strategy).toBe('facts_mixed');
    expect(data.challenges.length).toBeGreaterThanOrEqual(8);
    data.challenges.forEach((c) => expect(c.sum).toBeLessThanOrEqual(10));
  });

  it('keeps full sums when the pinned family has nothing under the window', async () => {
    generateContent.mockReset();
    window(10);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'Big Facts', description: 'Practice.', strategy: 'facts_7_8', objectEmoji: '💎' }),
    } as never);
    const data = await generateAdditionFactStrategies('7s and 8s', 'Grade 2', { strategy: 'facts_7_8' });
    expect(data.strategy).toBe('facts_7_8');
    expect(data.challenges).toHaveLength(6);
  });
});
