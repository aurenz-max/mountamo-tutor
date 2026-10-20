import { describe, expect, it } from 'vitest';
import { lexWord } from './lexicon';
import { mulberry32, tierPick } from './pick';
import { soundSwapSpace, type SwapOperation } from './soundSwapSpaces';
import { deriveOperationFields } from '../literacy/gemini-sound-swap';
import { moveAsk } from '../../primitives/visual-primitives/literacy/soundSwapDomain';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const OPS: SwapOperation[] = ['addition', 'deletion', 'substitution'];
const phones = (w: string) => lexWord(w)!.phones;

describe.each(['K', '1'])('sound-swap spaces, grade %s', (grade) => {
  it.each(OPS)('%s: both words real, the move re-derives from the phonemes, the ask names it', (op) => {
    const space = soundSwapSpace(op, grade);
    expect(space.length).toBeGreaterThanOrEqual(30);
    for (const it of space) {
      const a = phones(it.payload.originalWord); const b = phones(it.payload.resultWord);
      const ch = deriveOperationFields({ id: 'c1', ...it.payload });
      if (op === 'addition') {
        expect(b.length).toBe(a.length + 1);
        expect(ch.addPosition === 'beginning' ? b.slice(1) : b.slice(0, -1)).toEqual(a);
        expect(it.payload.resultWord).not.toBe(`${it.payload.originalWord}s`);
      } else if (op === 'deletion') {
        expect(a.length).toBe(b.length + 1);
        expect(ch.deletePosition === 'beginning' ? a.slice(1) : a.slice(0, -1)).toEqual(b);
      } else {
        expect(a.filter((p, i) => p !== b[i])).toHaveLength(1);
      }
      expect(it.payload.originalPhonemes).toHaveLength(a.length);
      expect(moveAsk(ch)).not.toMatch(new RegExp(`\b${it.payload.resultWord}\b`));
    }
  });
  it.each(OPS)('%s: easy < medium < hard; a 9-item session fills', (op) => {
    const means = TIERS.map((t) => {
      const picks = tierPick(soundSwapSpace(op, grade), t, 9, mulberry32(3));
      expect(picks).toHaveLength(9);
      return picks.reduce((s, p) => s + p.beta, 0) / 9;
    });
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
  });
});

describe('sound-swap rules', () => {
  it('K adds and takes away a lone first or last sound, never inside a cluster', () => {
    for (const op of ['addition', 'deletion'] as const) {
      expect(soundSwapSpace(op, 'K').every((it) => !it.structure.endsWith('cluster'))).toBe(true);
    }
    expect(soundSwapSpace('addition', '1').some((it) => it.structure === 'beginning:cluster')).toBe(true);
  });
  it('a mixed session never asks for a word an earlier item showed', () => {
    const rand = mulberry32(8); const used = new Set<string>(); const heard = new Set<string>();
    const shown: string[] = [];
    for (const op of OPS) for (const p of tierPick(soundSwapSpace(op, 'K'), 'medium', 3, rand, used, heard)) {
      expect(shown).not.toContain(p.produces);
      shown.push(p.payload.originalWord);
    }
  });
  it('no pair is built on an unstressed function word (to -> tub, end -> and)', () => {
    for (const op of OPS) for (const g of ['K', '1']) {
      expect(soundSwapSpace(op, g).some((it) => ['to', 'and', 'the', 'a'].includes(it.payload.originalWord) || ['to', 'and', 'the', 'a'].includes(it.payload.resultWord))).toBe(false);
    }
  });
});
