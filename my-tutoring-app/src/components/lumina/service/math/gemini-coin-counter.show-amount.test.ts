/**
 * show-amount (open build): code owns the amount, the bins and the ask. The model only names what each amount is
 * for, and a name carrying a number or a coin is dropped. Amounts are distinct, within the band's ceiling and any
 * bound the lesson states, never one coin's value (the ask is a mix), and the instruction states the amount.
 */
import { beforeEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateCoinCounter } from './gemini-coin-counter';
import { coinCounterOracle } from '../qa/oracles/coin-counter';

const generateContent = vi.mocked(ai.models.generateContent);

const ctx = (grade: string, intent?: string): GenerationContext => ({
  componentId: 'coin-counter', instanceId: 'cc', topic: 'Counting money', gradeLevel: 'elementary',
  gradeContext: `Grade ${grade}`, grade, intent, objective: {}, scope: { topic: 'Counting money', intent },
  targetEvalMode: 'show-amount', raw: { targetEvalMode: 'show-amount' },
});

beforeEach(() => {
  generateContent.mockReset();
  generateContent.mockResolvedValue({ text: JSON.stringify({ challenges: [
    { thing: 'a sticker' }, { thing: 'a 5 cent gum' }, { thing: 'a dime bag' }, { thing: 'an apple' }, { thing: 'a toy car' },
  ] }) } as never);
});

it.each([['K', 20, ['penny', 'nickel', 'dime']], ['1', 50, ['penny', 'nickel', 'dime', 'quarter']],
  ['2', 99, ['penny', 'nickel', 'dime', 'quarter', 'half-dollar']]] as const)(
  'grade %s: four distinct amounts up to %i, never one coin, stated in the ask', async (grade, ceiling, bins) => {
    for (let run = 0; run < 5; run++) {
      const data = await generateCoinCounter(ctx(grade));
      const amounts = data.challenges.map(c => c.targetAmount!);
      expect(data.challenges.every(c => c.type === 'show-amount')).toBe(true);
      expect(amounts).toHaveLength(4);
      expect(new Set(amounts).size).toBe(4);
      for (const c of data.challenges) {
        expect(c.targetAmount).toBeLessThanOrEqual(ceiling);
        expect([1, 5, 10, 25, 50, 100]).not.toContain(c.targetAmount);
        expect(c.availableCoins).toEqual(bins);
        expect(c.instruction).toMatch(new RegExp(`^Show ${c.targetAmount}¢ (for (a|an) [a-z ]+, )?any way you like\\.$`));
        expect(c.instruction).not.toMatch(/gum|bag/);
      }
      expect(coinCounterOracle.verify(data as never, { topic: 'Counting money' } as never).violations).toEqual([]);
    }
  });

it('a bound the lesson states lowers the ceiling', async () => {
  const data = await generateCoinCounter(ctx('2', 'Make amounts within 20 cents'));
  expect(Math.max(...data.challenges.map(c => c.targetAmount!))).toBeLessThanOrEqual(20);
  expect(data.challenges[0].availableCoins).toEqual(['penny', 'nickel', 'dime']);
});

it('a failed model call still ships the build with fallback names', async () => {
  generateContent.mockRejectedValue(new Error('down'));
  const data = await generateCoinCounter(ctx('1'));
  expect(data.challenges).toHaveLength(4);
  expect(data.challenges[0].instruction).toMatch(/^Show \d+¢ for a /);
});
