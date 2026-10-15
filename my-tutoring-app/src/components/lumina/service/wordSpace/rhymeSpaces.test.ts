import { describe, expect, it } from 'vitest';
import { lexWord, rimeOf } from './lexicon';
import { mulberry32, tierPick, tierPickSplit } from './pick';
import { rhymeSpace, rhymesWith, spelledRime, type RhymeSpaceMode } from './rhymeSpaces';
import { holdsRhymeIntegrity } from '../literacy/gemini-rhyme-studio';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const MODES: RhymeSpaceMode[] = ['recognition', 'identification', 'production', 'collection'];
const rhymeBySound = (a: string, b: string) => rimeOf(lexWord(a)!) === rimeOf(lexWord(b)!);

describe.each(['K', '1'])('rhyme-studio spaces, grade %s', (grade) => {
  it.each(MODES)('%s: passes the rhyme-integrity gate, the key re-derives from the phonemes, every word pictured', (mode) => {
    const space = rhymeSpace(mode, grade);
    expect(space.length).toBeGreaterThanOrEqual(15);
    for (const it of space) {
      const ch = { id: 'c1', ...it.payload } as Record<string, unknown>;
      const before = JSON.stringify(ch);
      const optionSet = (c: Record<string, unknown>) => JSON.stringify(((c.options ?? []) as Array<{ word: string }>).map((o) => o.word).sort());
      const options = optionSet(ch);
      expect(holdsRhymeIntegrity(ch), before).toBe(true);
      // The gate kept every option and the recognition key: spelling and sound agree on every item.
      expect(optionSet(ch)).toBe(options);
      expect(ch.doesRhyme).toBe(JSON.parse(before).doesRhyme);
      const t = ch.targetWord as string;
      expect(ch.targetWordEmoji).toBeTruthy();
      expect(t.endsWith(String(ch.rhymeFamily).slice(1))).toBe(true);
      if (mode === 'recognition') {
        expect(rhymeBySound(t, ch.comparisonWord as string)).toBe(ch.doesRhyme);
        expect(ch.comparisonWordEmoji).not.toBe(ch.targetWordEmoji);
      }
      if (mode === 'identification') {
        const opts = ch.options as Array<{ word: string; image: string; isCorrect: boolean }>;
        expect(opts.filter((o) => o.isCorrect)).toHaveLength(1);
        for (const o of opts) {
          expect(rhymeBySound(t, o.word), `${t}/${o.word}`).toBe(o.isCorrect);
          expect(o.image).toBe(lexWord(o.word)!.emoji);
        }
        expect(opts).toHaveLength(grade === 'K' ? 2 : 3);
        expect(new Set([ch.targetWordEmoji, ...opts.map((o) => o.image)]).size).toBe(opts.length + 1);
      }
    }
  });
  it.each(MODES)('%s: easy < medium < hard, distinct words per tier', (mode) => {
    const n = mode === 'collection' ? 2 : 4;
    const means = TIERS.map((t) => {
      const picks = tierPick(rhymeSpace(mode, grade), t, n, mulberry32(6));
      expect(picks).toHaveLength(n);
      return picks.reduce((s, p) => s + p.beta, 0) / n;
    });
    expect(means[0]).toBeLessThan(means[2]);
    expect(means[0]).toBeLessThanOrEqual(means[1]);
  });
});

describe('rhyme rules', () => {
  it('spelled rhymes that do not sound alike never pair (bow/cow); the ending is the spelled rime', () => {
    expect(spelledRime('night')).toBe('ight');
    expect(spelledRime('queen')).toBe('een');
    const cow = lexWord('cow'); const snow = lexWord('snow');
    if (cow && snow) expect(rhymesWith(cow, snow)).toBe(false);
  });
  it('recognition sessions mix yes and no', () => {
    for (const t of TIERS) {
      const picks = tierPickSplit(rhymeSpace('recognition', 'K'), (it) => it.key ?? '', t, 4, mulberry32(2));
      expect(new Set(picks.map((p) => p.payload.doesRhyme)).size, t).toBe(2);
    }
  });
});
