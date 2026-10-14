import { describe, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { spreadReadTargets, type BarModelChallenge } from './gemini-bar-model';

const bars = (vals: number[]) => vals.map((value, i) => ({ label: ['Leo', 'Mia', 'Sam', 'Ava'][i], value }));
const read = (vals: number[], t: number): BarModelChallenge => ({
  id: 'x', evalMode: 'read_scale', values: bars(vals), graphStyle: 'scaled_bar', scale: { step: 2, max: 20 },
  prompt: `How many stickers did ${['Leo', 'Mia', 'Sam', 'Ava'][t]} collect?`, expectedValue: vals[t], targetBarIndex: t,
});

describe('bar-model read targets', () => {
  it('a repeated graph in one session becomes a different question, and the key follows the label', () => {
    const s = [read([4, 12, 8, 16], 1), read([4, 12, 8, 16], 1), read([4, 12, 8, 16], 1), read([4, 12, 8, 16], 1)];
    spreadReadTargets(s);
    const asks = s.map((c) => `${c.prompt}=${c.expectedValue}`);
    expect(new Set(asks).size).toBe(4);
    for (const c of s) {
      const label = c.prompt.match(/did (\w+) collect/)![1];
      expect(c.values[c.targetBarIndex!].label).toBe(label);
      expect(c.values[c.targetBarIndex!].value).toBe(c.expectedValue);
    }
  });

  it('spreads the answer position across a session and keeps compare_bars at its gap', () => {
    const s: BarModelChallenge[] = Array.from({ length: 6 }, () => ({
      id: 'c', evalMode: 'compare_bars', values: bars([4, 8]), graphStyle: 'bar', prompt: 'Which is taller?', targetBarIndex: 1,
    }));
    spreadReadTargets(s);
    expect(new Set(s.map((c) => c.targetBarIndex))).toEqual(new Set([0, 1]));
    for (const c of s) {
      expect(Math.abs(c.values[0].value - c.values[1].value)).toBe(4);
      expect(c.values[c.targetBarIndex!].value).toBeGreaterThan(c.values[1 - c.targetBarIndex!].value);
      expect(Math.max(c.values[0].value, c.values[1].value)).toBeLessThanOrEqual(10);
    }
  });
});
