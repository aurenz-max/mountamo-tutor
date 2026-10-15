import { describe, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { pickWidthsForTier } from './gemini-measurement-tools';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('measurement-tools widths by tier', () => {
  it('measure hard draws odd widths first (unlabeled marks on the sparse ruler)', () => {
    for (let i = 0; i < 30; i++) expect(pickWidthsForTier('measure', range(1, 8), 4, 'hard', 1).every((w) => w % 2 === 1)).toBe(true);
  });
  it('compare easy keeps widths 2 apart; hard is a consecutive run', () => {
    for (let i = 0; i < 30; i++) {
      const e = pickWidthsForTier('compare', range(2, 8), 3, 'easy', 1).sort((a, b) => a - b);
      expect(e.every((w, j) => j === 0 || w - e[j - 1] >= 2)).toBe(true);
      const e4 = pickWidthsForTier('compare', range(2, 8), 4, 'easy', 1).sort((a, b) => a - b);
      expect(e4.filter((w, j) => j > 0 && w - e4[j - 1] === 1).length).toBeLessThanOrEqual(1);
      const h = pickWidthsForTier('compare', range(2, 8), 4, 'hard', 1).sort((a, b) => a - b);
      expect(h).toHaveLength(4);
      expect(h.every((w, j) => j === 0 || w - h[j - 1] === 1)).toBe(true);
    }
  });
  it('a pool too small for the pattern falls back to a plain distinct draw', () => {
    const w = pickWidthsForTier('compare', [2, 3, 4], 3, 'easy', 1);
    expect(new Set(w).size).toBe(3);
  });
});
