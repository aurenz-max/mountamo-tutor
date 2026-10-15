import { describe, expect, it } from 'vitest';
import { lexWord, isVowel } from './lexicon';
import { mulberry32, tierPick, tierPickFocus } from './pick';
import { blendFocus, blendScope, blendSpace, blendTiles, type BlendPattern } from './phonicsSpaces';
import { scopeFromObjective } from './scope';
import { isBlendWordUsable, pickBundledPattern } from '../literacy/gemini-phonics-blender';
import { blendItems, } from '../../primitives/visual-primitives/literacy/phonicsBlenderWorkspace';
import { soundWalk } from '../../primitives/visual-primitives/literacy/phonicsBlenderScript';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const CASES: Array<[BlendPattern, string]> = [['cvc', 'K'], ['cvc', '1'], ['cvce', '1'], ['blend', '1'], ['digraph', '1'], ['r-controlled', '1'], ['r-controlled', '2'], ['diphthong', '1'], ['diphthong', '2']];
const asWord = (p: { targetWord: string; phonemes: Array<{ sound: string; letters: string }>; emoji?: string }, i = 0) =>
  ({ id: `w${i + 1}`, ...p, phonemes: p.phonemes.map((t, j) => ({ id: `w${i + 1}_p${j + 1}`, ...t })) });

describe.each(CASES)('phonics-blender %s space, grade %s', (pattern, grade) => {
  const space = blendSpace(pattern, grade, null);
  it('every word passes the generator gate, and its tiles re-derive from the phonemes', () => {
    expect(space.length).toBeGreaterThanOrEqual(15);
    for (const it of space) {
      const w = asWord(it.payload);
      expect(isBlendWordUsable(w, pattern), `${w.targetWord} ${JSON.stringify(w.phonemes)}`).toBe(true);
      // One sound tile per phoneme group: the non-silent tiles cover the word's phonemes in order.
      const x = lexWord(w.targetWord)!;
      const sounding = w.phonemes.filter((t) => t.sound !== '//');
      expect(sounding.length).toBe(x.gpcs!.length);
      // The tutor can say the walk for every word that has no silent e.
      if (pattern !== 'cvce') expect(soundWalk(blendItems([w])[0]).length, w.targetWord).toBeGreaterThan(0);
    }
  });
  it('easy < medium < hard, distinct words per tier', () => {
    const means = TIERS.map((tier) => {
      const picks = tierPick(space, tier, 5, mulberry32(5));
      expect(picks).toHaveLength(5);
      expect(new Set(picks.map((p) => p.words[0])).size).toBe(5);
      return picks.reduce((s, p) => s + p.beta, 0) / 5;
    });
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
  });
});

describe('phonics-blender rules', () => {
  it('cvc at K is one letter per sound with a short vowel', () => {
    for (const it of blendSpace('cvc', 'K', null)) {
      const x = lexWord(it.words[0])!;
      expect(x.phones.filter(isVowel)).toHaveLength(1);
      expect(['AE', 'EH', 'IH', 'AA', 'AO', 'AH']).toContain(x.phones[1]);
    }
  });
  it('silent e is its own last tile; cute is /k/ /yoo/ /t/ e', () => {
    expect(blendTiles(lexWord('cake')!)).toEqual([{ letters: 'c', sound: '/k/' }, { letters: 'a', sound: '/ā/' }, { letters: 'k', sound: '/k/' }, { letters: 'e', sound: '//' }]);
    expect(blendTiles(lexWord('cute')!).map((t) => t.sound)).toEqual(['/k/', '/yoo/', '/t/', '//']);
    expect(blendSpace('cvce', '1', null).some((it) => ['fire', 'here', 'dove', 'come'].includes(it.words[0]))).toBe(false);
  });
  it('no plurals or past tense in a decoding list', () => {
    for (const p of ['cvc', 'blend', 'digraph'] as const) {
      expect(blendSpace(p, '1', null).some((it) => ['cats', 'blocks', 'chips', 'jumped'].includes(it.words[0]))).toBe(false);
    }
  });
  it('a short-vowel objective keeps every word on that vowel', () => {
    const scope = scopeFromObjective(["Decode CVC words with Short 'e' (e.g., hen, wet, leg)"]);
    const space = blendSpace('cvc', 'K', scope);
    expect(space.every((it) => lexWord(it.words[0])!.phones[1] === 'EH')).toBe(true);
    for (const tier of TIERS) expect(tierPick(space, tier, 5, mulberry32(1))).toHaveLength(5);
  });
  it('letter group 1 at K: every word inside s a t i p n, still tiered', () => {
    const scope = scopeFromObjective(['Letter Group 1: s, a, t, i, p, n']);
    const space = blendSpace('cvc', 'K', scope);
    expect(space.every((it) => Array.from(it.words[0]).every((c) => 'satipn'.includes(c)))).toBe(true);
    const bs = blendScope('cvc', scope);
    const means = TIERS.map((tier) => {
      const picks = tierPickFocus(space, blendFocus(bs), tier, 4, mulberry32(2));
      expect(picks.length).toBeGreaterThanOrEqual(4);
      return picks.reduce((s, p) => s + p.beta, 0) / picks.length;
    });
    expect(means[0]).toBeLessThanOrEqual(means[2]);
  });
  it('a word gets the same tiles every time (an IRT item must not change)', () => {
    const a = blendSpace('digraph', '1', null).find((it) => it.words[0] === 'ship');
    expect(a?.payload.phonemes.map((t) => t.letters)).toEqual(['sh', 'i', 'p']);
  });
  it('advanced reads r-controlled or diphthong from the objective', () => {
    expect(pickBundledPattern(['r-controlled', 'diphthong'], 'Decode words with r-controlled vowels', () => 0.99)).toBe('r-controlled');
    expect(pickBundledPattern(['r-controlled', 'diphthong'], 'Read words with diphthongs oi, oy', () => 0)).toBe('diphthong');
  });
});
