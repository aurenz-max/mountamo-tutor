import { describe, expect, it } from 'vitest';
import { lexWord } from './lexicon';
import { mulberry32, tierPick } from './pick';
import { namingSpace, nounPool, receptiveSpace, sortSpace } from './categorySpaces';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const mean = (ps: Array<{ beta: number }>) => ps.reduce((s, p) => s + p.beta, 0) / ps.length;

describe.each(['K', '1'])('category spaces, grade %s', (grade) => {
  it('every noun is pictured, in its reviewed category, one word per picture', () => {
    const pool = nounPool(grade);
    expect(pool.length).toBeGreaterThan(100);
    expect(new Set(pool.map((x) => x.emoji)).size).toBe(pool.length);
    for (const x of pool) expect(lexWord(x.w)!.category).toBe(x.category);
  });
  it('receptive_match: four distinct pictures, the key is the target, hard holds same-category wrong cards', () => {
    const space = receptiveSpace(grade);
    for (const it of space) {
      const all = [it.payload.target, ...it.payload.wrong];
      expect(new Set(all.map((c) => c.emoji)).size).toBe(4);
      expect(it.payload.wrong.some((c) => c.word === it.payload.target.word)).toBe(false);
      if (it.structure === 'all-same') expect(it.payload.wrong.every((c) => c.category === it.payload.target.category)).toBe(true);
      if (it.structure === 'far') expect(it.payload.wrong.every((c) => c.category !== it.payload.target.category)).toBe(true);
    }
    const m = TIERS.map((t) => mean(tierPick(space, t, 5, mulberry32(2))));
    expect(m[0]).toBeLessThan(m[1]); expect(m[1]).toBeLessThan(m[2]);
  });
  it('naming and sorts: easy < hard', () => {
    const n = TIERS.map((t) => mean(tierPick(namingSpace(grade), t, 5, mulberry32(2))));
    expect(n[0]).toBeLessThan(n[2]);
    for (const bins of [2, 3] as const) {
      const space = sortSpace(grade, bins, bins === 2 ? 4 : 3);
      for (const it of space) {
        expect(it.payload.cards.every((c) => it.payload.categories.includes(c.category))).toBe(true);
        expect(new Set(it.payload.cards.map((c) => c.word)).size).toBe(it.payload.cards.length);
      }
      const s = TIERS.map((t) => mean(tierPick(space, t, 1, mulberry32(4))));
      expect(s[0]).toBeLessThan(s[2]);
    }
  });
});

describe('noun pictures', () => {
  it('no action picture names a noun (jog 🏃)', () => {
    expect(nounPool('1').some((x) => ['🏃', '🤸', '🏊'].some((e) => x.emoji!.includes(e)))).toBe(false);
  });
});

describe('word-sorter concept sorts', () => {
  it('every space sort passes the generator gate, named categories are honored, grammar sorts stay on the model', async () => {
    const { conceptSortsForTest } = await import('../literacy/gemini-word-sorter');
    for (const tier of TIERS) {
      const sorts = conceptSortsForTest('binary_sort', 'Sort common objects into categories such as animals and food', 'K', tier)!;
      expect(sorts).toHaveLength(3);
      for (const s of sorts) expect([...(s.bucketLabels ?? [])].sort()).toEqual(['Animals', 'Food']);
      const tri = conceptSortsForTest('ternary_sort', 'Sort words into categories', '1', tier)!;
      expect(tri).toHaveLength(3);
      for (const s of tri) expect(s.words?.length ?? 0).toBeGreaterThanOrEqual(6);
    }
    expect(conceptSortsForTest('binary_sort', 'Sort nouns and verbs', 'K', 'easy')).toBeNull();
  });
});
