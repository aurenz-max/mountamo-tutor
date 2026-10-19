import { describe, expect, it } from 'vitest';
import { lexWord, isVowel } from './lexicon';
import { mulberry32, tierPick } from './pick';
import { phonemeSpace, type PhonemeSpaceMode } from './phonemeSpaces';
import { itemFromChallenge, itemsFromChallenges, type PhonemeChallengeLike } from '../../primitives/visual-primitives/literacy/phonemeExplorerDomain';
import type { SupportTier } from '../generation/generationContext';

const MODES: PhonemeSpaceMode[] = ['isolate', 'ending', 'medial', 'blend', 'segment', 'manipulate'];
const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const phones = (w: string) => lexWord(w)!.phones;
type Card = { word: string; correct: boolean };

describe('word library', () => {
  it('maps letters to sounds, so a letter scope cannot admit another sound', () => {
    expect(lexWord('pain')!.gpcs).toContain('ai/EY');
    expect(lexWord('is')!.gpcs).toContain('s/Z');
    expect(lexWord('cake')!.gpcs).toContain('a_e/EY');
  });
  it('applies the reviewed ratings and drops informal words', () => {
    expect(lexWord('alligator')?.knownBy).not.toBe('K');
    expect(lexWord('tummy')).toBeUndefined();
    expect(lexWord('sis')).toBeUndefined();
    expect(lexWord('cat')?.knownBy).toBe('K');
  });
});

describe.each(['K', '1'])('phoneme-explorer word spaces, grade %s', (grade) => {
  it.each(MODES)('%s: every item passes the component gates and its answer key is right', (mode) => {
    const space = phonemeSpace(mode, grade);
    expect(space.length).toBeGreaterThanOrEqual(15);
    for (const it of space) {
      const ch = { id: 'c1', mode, ...it.payload } as unknown as PhonemeChallengeLike;
      expect(itemFromChallenge(ch), `${mode} ${it.words.join(',')}`).not.toBeNull();
      const cards = (it.payload.choices ?? []) as Card[];
      const answer = cards.find((c) => c.correct)?.word;
      const wrong = cards.filter((c) => !c.correct).map((c) => c.word);
      if (mode === 'isolate') {
        const T = phones(answer!)[0];
        expect(phones(it.payload.exampleWord as string)[0]).toBe(T);
        expect(wrong.every((w) => phones(w)[0] !== T)).toBe(true);
      } else if (mode === 'ending') {
        const F = phones(it.payload.targetWord as string).at(-1);
        expect(phones(answer!).at(-1)).toBe(F);
        expect(wrong.every((w) => phones(w).at(-1) !== F)).toBe(true);
      } else if (mode === 'medial') {
        const v = phones(it.payload.targetWord as string)[1];
        const same = (a: string, b: string) => a === b || (['AA', 'AO'].includes(a) && ['AA', 'AO'].includes(b));
        expect(same(phones(answer!)[1], v)).toBe(true);
        expect(wrong.every((w) => !same(phones(w)[1], v))).toBe(true);
      } else if (mode === 'blend') {
        expect((it.payload.phonemeSequence as string[]).length).toBe(phones(it.payload.word as string).length);
      } else if (mode === 'segment') {
        const p = phones(it.payload.targetWord as string);
        expect((it.payload.segments as string[]).length).toBe(p.length);
        expect(p.filter(isVowel)).toHaveLength(1);
      } else {
        const a = phones(it.payload.originalWord as string); const b = phones(it.payload.resultWord as string);
        expect(a.filter((x, i) => x !== b[i])).toHaveLength(1);
        if (grade === 'K') expect(a[0]).not.toBe(b[0]);
      }
    }
  });

  it.each(MODES)('%s: easy < medium < hard, five distinct items per tier', (mode) => {
    const means = TIERS.map((tier) => {
      const picks = tierPick(phonemeSpace(mode, grade), tier, 5, mulberry32(7));
      expect(picks).toHaveLength(5);
      const words = picks.flatMap((p) => p.words);
      expect(new Set(words).size).toBe(words.length);
      return picks.reduce((s, p) => s + p.beta, 0) / 5;
    });
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
  });
});

describe('a mixed K session drawn from the spaces', () => {
  it('loses no item to the session leak gate and varies across sessions', () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3]) {
      const rand = mulberry32(seed); const used = new Set<string>(); const heard = new Set<string>();
      const challenges = MODES.map((mode, i) => {
        const [p] = tierPick(phonemeSpace(mode, 'K'), 'medium', 1, rand, used, heard);
        seen.add(p.words[0]);
        return { id: `c${i + 1}`, mode, ...p.payload } as unknown as PhonemeChallengeLike;
      });
      expect(itemsFromChallenges(challenges)).toHaveLength(6);
    }
    expect(seen.size).toBeGreaterThan(12);
  });

  it('segment answers are not always three at K', () => {
    const counts = new Set(TIERS.flatMap((t) => tierPick(phonemeSpace('segment', 'K'), t, 5, mulberry32(3)).map((p) => (p.payload.segments as string[]).length)));
    expect(counts.size).toBeGreaterThan(1);
  });
});

describe('session rules found by the after-probe', () => {
  it('medial: rhyme alone never finds the answer', () => {
    for (const it of phonemeSpace('medial', 'K')) {
      const target = it.payload.targetWord as string;
      const cards = it.payload.choices as Card[];
      const rhymes = cards.filter((c) => phones(c.word)[2] === phones(target)[2]);
      // Either no card shares the ending, or more than the answer does.
      expect(rhymes.length === 0 || rhymes.length > 1 || !rhymes[0].correct, `${target}: ${cards.map((c) => c.word)}`).toBe(true);
    }
  });
  it('isolate, ending and medial do not repeat the asked sound within a session', () => {
    for (const mode of ['isolate', 'ending', 'medial'] as const) for (const tier of TIERS) {
      const picks = tierPick(phonemeSpace(mode, 'K'), tier, 5, mulberry32(11));
      // Medial easy may hold 4 vowels: short e is the hardest vowel and sits above the easy third.
      expect(new Set(picks.map((p) => p.key)).size, `${mode} ${tier}`).toBeGreaterThanOrEqual(mode === 'medial' ? 4 : 5);
    }
  });
  it('blend at K says each vowel the way its letter spells it; segment skips r after the vowel', () => {
    expect(phonemeSpace('blend', 'K').some((it) => ['ball', 'wash', 'watch'].includes(it.payload.word as string))).toBe(false);
    expect(phonemeSpace('segment', 'K').some((it) => ['jar', 'fire', 'pear'].includes(it.payload.targetWord as string))).toBe(false);
  });
});
