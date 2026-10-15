import { describe, expect, it } from 'vitest';
import { lexWord } from './lexicon';
import { mulberry32, tierPick } from './pick';
import { scopeFromObjective, type LetterScope } from './scope';
import { DOLCH, cvcReadingSpace, drawWordReading, sightShare, sightWordSpace, type WordReadingMode } from './diWordReadingSpaces';
import {
  buildWordReadingItems, wordReadingChallengeValid, type DiWordReadingChallenge,
} from '../../primitives/visual-primitives/direct-instruction/diWordReadingDomain';
import { modelFor } from '../../primitives/visual-primitives/direct-instruction/diWordReadingLevers';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const MODES: WordReadingMode[] = ['cvc_reading', 'read_word', 'sight_word', 'word_reading_review'];
const SHORT = ['AE', 'EH', 'IH', 'AA', 'AO', 'AH'];
const GROUP1 = scopeFromObjective(['Letter-Sound Group 1: s, a, t, i, p, n']);
const SHORT_A = scopeFromObjective(["Decode CVC words with Short 'a' (e.g., cat, map, van)"]);
const asChallenge = (p: ReturnType<typeof cvcReadingSpace>[number]['payload'], i: number, mode: WordReadingMode): DiWordReadingChallenge =>
  ({ id: `diwr-${i + 1}-${p.word}`, challengeType: mode, ...p });
const mean = (xs: { beta: number }[]) => xs.reduce((s, x) => s + x.beta, 0) / xs.length;

const SPACES: Array<[string, () => ReturnType<typeof cvcReadingSpace>, WordReadingMode]> = [
  ['cvc K', () => cvcReadingSpace('K', null), 'cvc_reading'], ['cvc 1', () => cvcReadingSpace('1', null), 'cvc_reading'],
  ['cvc K short a', () => cvcReadingSpace('K', SHORT_A), 'cvc_reading'], ['cvc K group 1', () => cvcReadingSpace('K', GROUP1), 'cvc_reading'],
  ['sight K', () => sightWordSpace('K'), 'sight_word'], ['sight 1', () => sightWordSpace('1'), 'sight_word'],
];

describe.each(SPACES)('di-word-reading %s space', (_name, space, mode) => {
  it('every item passes the domain gate and builds one askable item', () => {
    const items = space();
    expect(items.length).toBeGreaterThanOrEqual(8);
    items.forEach((it, i) => {
      const c = asChallenge(it.payload, i, mode);
      expect(wordReadingChallengeValid(c), JSON.stringify(c)).toBe(true);
      expect(buildWordReadingItems([c])).toHaveLength(1);
    });
  });
  it('the key re-derives from the phonemes', () => {
    for (const it of space()) {
      const w = it.payload.word;
      const x = lexWord(w);
      if (it.payload.wordType === 'cvc') {
        // One letter per sound, the middle one a short vowel, and the letters spell the word.
        expect(it.payload.graphemes!.join('')).toBe(w);
        expect(x!.gpcs!.map((g) => g.split('/')[0])).toEqual(it.payload.graphemes);
        expect(SHORT).toContain(x!.phones[1]);
      } else {
        expect(it.payload.graphemes).toBeUndefined();
        expect(it.payload.emoji).toBeUndefined();
      }
    }
  });
  it('easy < medium < hard by mean beta, four distinct words per tier', () => {
    const items = space();
    const means = TIERS.map((tier) => {
      const picks = tierPick(items, tier, 4, mulberry32(11));
      expect(picks).toHaveLength(4);
      expect(new Set(picks.map((p) => p.words[0])).size).toBe(4);
      return mean(picks);
    });
    // A narrow scope (group 1 holds 8 words) tiers by overlapping windows: the ends still separate.
    if (items.length >= 12) expect(means[0]).toBeLessThan(means[1]);
    if (items.length >= 12) expect(means[1]).toBeLessThan(means[2]);
    expect(means[0]).toBeLessThan(means[2]);
  });
});

describe('di-word-reading space rules', () => {
  const words = (s: readonly { words: string[] }[]) => s.map((it) => it.words[0]);
  it('a letter-group lesson uses only its letter-sounds (no mat, cat, hat for s a t i p n)', () => {
    const group = words(cvcReadingSpace('K', GROUP1));
    expect(group.length).toBeGreaterThanOrEqual(6);
    for (const w of group) expect(w.split('').every((l) => 'satipn'.includes(l)), w).toBe(true);
  });
  it('a short-vowel lesson binds every word to that vowel', () => {
    for (const w of words(cvcReadingSpace('K', SHORT_A))) expect(w[1]).toBe('a');
  });
  it('a sight word is one the grade cannot decode: and/big/can never; see and make at K only', () => {
    const k = words(sightWordSpace('K'));
    const g1 = words(sightWordSpace('1'));
    for (const w of ['and', 'big', 'can', 'run', 'jump', 'did']) { expect(k).not.toContain(w); expect(g1).not.toContain(w); }
    for (const w of ['see', 'make', 'go', 'my']) { expect(k).toContain(w); expect(g1).not.toContain(w); }
    for (const w of ['the', 'said', 'was', 'you', 'is', 'to']) expect(k).toContain(w);
    for (const w of ['of', 'were', 'could', 'once']) expect(g1).toContain(w);
    // Every sight word is on a Dolch list of the grade.
    for (const w of k) expect([...DOLCH.preprimer, ...DOLCH.primer]).toContain(w);
  });
  it('a heteronym or an inflected word never enters', () => {
    expect(words(sightWordSpace('1'))).not.toContain('live');
    expect(words(sightWordSpace('1'))).not.toContain('going');
  });
  it('look-alikes and second syllables cost more: the/was/said above go/see; funny above make', () => {
    const b = new Map(sightWordSpace('K').map((it) => [it.words[0], it.beta]));
    expect(b.get('was')!).toBeGreaterThan(b.get('go')!);
    expect(b.get('said')!).toBeGreaterThan(b.get('see')!);
    expect(b.get('funny')!).toBeGreaterThan(b.get('make')!);
    const c = new Map(cvcReadingSpace('K', null).map((it) => [it.words[0], it.beta]));
    expect(c.get('pot')!).toBeGreaterThan(c.get('hot')!); // pot reads as top backwards
  });
});

describe.each([['K', null], ['K', GROUP1], ['K', SHORT_A], ['1', null]] as Array<[string, LetterScope | null]>)(
  'di-word-reading session, grade %s, scope %#', (grade, parsed) => {
    // The generator's two session shapes: one pinned mode at the 6-word cap, or every mode sharing it (2, 2, 1, 1).
    const SHAPES: Array<Array<[WordReadingMode, number]>> = [...MODES.map((m) => [[m, 6]] as Array<[WordReadingMode, number]>),
      [['cvc_reading', 2], ['read_word', 2], ['sight_word', 1], ['word_reading_review', 1]]];
    it.each(TIERS)('%s: every mode fills, no word repeats, nothing is dropped, every item has a model card', (tier) => {
      for (const shape of SHAPES) for (let seed = 1; seed <= 30; seed++) {
        const rand = mulberry32(seed);
        const used = new Set<string>();
        const heard = new Set<string>();
        const challenges: DiWordReadingChallenge[] = [];
        for (const [mode, n] of shape) {
          const picks = drawWordReading(mode, n, grade, parsed, tier, rand, used, heard);
          expect(picks, `${mode} x${n} seed ${seed}`).toHaveLength(n);
          if (mode === 'read_word' || mode === 'word_reading_review') {
            expect(picks.filter((p) => p.payload.wordType === 'sight')).toHaveLength(sightShare(n));
          }
          picks.forEach((p) => challenges.push(asChallenge(p.payload, challenges.length, mode)));
        }
        expect(new Set(challenges.map((c) => c.word)).size).toBe(challenges.length);
        const items = buildWordReadingItems(challenges);
        expect(items).toHaveLength(challenges.length);
        // Easy starts with the model card on screen, so every item needs one (R3: a different word).
        for (const item of items) expect(modelFor(item, items), `${item.word} seed ${seed}`).not.toBeNull();
      }
    });
  });

describe('di-word-reading review', () => {
  it('spreads the CVC words across vowels', () => {
    const picks = drawWordReading('word_reading_review', 6, 'K', null, 'medium', mulberry32(3), new Set(), new Set());
    const vowels = picks.filter((p) => p.payload.wordType === 'cvc').map((p) => p.payload.word[1]);
    expect(new Set(vowels).size).toBe(vowels.length);
  });
});
