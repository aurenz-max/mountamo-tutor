import { describe, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { resolveProblemShape } from '../direct-instruction/gemini-di-sentence-reading';
import { lexWord } from './lexicon';
import { mulberry32, tierPick } from './pick';
import { scopeFromObjective, type LetterScope } from './scope';
import { bandTarget, drawSentences, sentenceFits, sentenceSpace, type SentenceMode } from './sentenceSpaces';
import { spokenForm } from '../../primitives/visual-primitives/direct-instruction/diSentenceReadingMenu';
import {
  buildSentenceReadingItems, type DiSentenceReadingChallenge,
} from '../../primitives/visual-primitives/direct-instruction/diSentenceReadingDomain';
import { modelFor } from '../../primitives/visual-primitives/direct-instruction/diSentenceReadingLevers';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const scope = (t: string) => scopeFromObjective([t]);
const GROUP1 = scope('Letter-Sound Group 1: s, a, t, i, p, n');
const GROUP2 = scope('Letter-Sound Group 2: c, k, e, h, r, m, d');
const SHORT_A = scope("Decode CVC words with Short 'a'");
const mean = (xs: { beta: number }[]) => xs.reduce((s, x) => s + x.beta, 0) / xs.length;
const asChallenge = (p: ReturnType<typeof sentenceSpace>[number]['payload'], i: number, mode: SentenceMode): DiSentenceReadingChallenge =>
  ({ id: `disr-${i + 1}`, challengeType: mode, ...p });

const CASES: Array<[string, SentenceMode, string, LetterScope | null, number]> = [
  ['decodable K', 'decodable_sentence', 'K', null, 6], ['decodable K group 1', 'decodable_sentence', 'K', GROUP1, 6],
  ['decodable K group 2', 'decodable_sentence', 'K', GROUP2, 6], ['decodable K short a', 'decodable_sentence', 'K', SHORT_A, 6],
  ['read K', 'read_sentence', 'K', null, 6], ['read 1', 'read_sentence', '1', null, 8],
  ['sight K', 'sight_phrase_sentence', 'K', null, 6], ['sight 1', 'sight_phrase_sentence', '1', null, 8],
  ['review 1', 'sentence_review', '1', null, 8],
];

describe.each(CASES)('di-sentence-reading %s space', (_name, mode, grade, parsed, ceiling) => {
  const space = sentenceSpace(mode, grade, parsed, ceiling);
  it('every sentence builds one askable item, inside the word ceiling', () => {
    expect(space.length).toBeGreaterThanOrEqual(12);
    space.forEach((it, i) => {
      expect(it.payload.wordCount).toBeLessThanOrEqual(ceiling);
      expect(it.payload.wordCount).toBe(spokenForm(it.payload.text).split(' ').length);
      expect(buildSentenceReadingItems([asChallenge(it.payload, i, mode)]), it.payload.text).toHaveLength(1);
    });
  });
  it('easy < medium < hard by mean beta, distinct sentences per tier', () => {
    const means = TIERS.map((tier) => {
      const picks = tierPick(space, tier, 4, mulberry32(7));
      expect(picks).toHaveLength(4);
      expect(new Set(picks.map((p) => p.payload.text)).size).toBe(4);
      return mean(picks);
    });
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
  });
});

describe('di-sentence-reading scope rules', () => {
  const texts = (s: readonly { payload: { text: string } }[]) => s.map((it) => it.payload.text);
  it('a group-1 sentence uses only s a t i p n (plus a, the, I)', () => {
    for (const t of texts(sentenceSpace('decodable_sentence', 'K', GROUP1, 6))) {
      for (const w of spokenForm(t).split(' ')) {
        if (['a', 'the', 'i'].includes(w)) continue;
        expect(w.split('').every((l) => 'satipn'.includes(l)), `${w} in "${t}"`).toBe(true);
      }
    }
    expect(sentenceFits('The red hen ran.', 'decodable_sentence', 'K', GROUP1)).toBe(false);
    expect(sentenceFits('The dog is hot.', 'decodable_sentence', 'K', GROUP1)).toBe(false);
  });
  it('a group-2 sentence uses at least one new letter-sound', () => {
    expect(sentenceFits('Pat sat.', 'decodable_sentence', 'K', GROUP2)).toBe(false);
    for (const t of texts(sentenceSpace('decodable_sentence', 'K', GROUP2, 6))) expect(/[ckehrmd]/.test(spokenForm(t).replace(/\bthe\b/g, '')), t).toBe(true);
  });
  it('a short-a sentence holds no content word with another vowel', () => {
    for (const t of texts(sentenceSpace('decodable_sentence', 'K', SHORT_A, 6))) {
      for (const w of spokenForm(t).split(' ')) {
        const x = lexWord(w);
        if (!x || ['a', 'the', 'i', 'in', 'on', 'up', 'it', 'at', 'an', 'and', 'can', 'had', 'but', 'not', 'if', 'us', 'am', 'is', 'to', 'has', 'his', 'as'].includes(w)) continue;
        expect(x.phones.some((p) => p === 'AE'), `${w} in "${t}"`).toBe(true);
      }
    }
  });
  it('a name follows the pattern rule: no Kim or Ken in a short-a sentence', () => {
    expect(sentenceFits('Kim has his cap.', 'decodable_sentence', 'K', SHORT_A)).toBe(false);
    expect(sentenceFits('Sam has a cap.', 'decodable_sentence', 'K', SHORT_A)).toBe(true);
  });
  it('decodable sentences hold no sight word beyond the first tricky words; sight sentences hold two', () => {
    expect(sentenceFits('I can see it.', 'decodable_sentence', 'K', null)).toBe(false);
    expect(sentenceFits('The cat sat.', 'decodable_sentence', 'K', null)).toBe(true);
    expect(sentenceFits('We go up and we go down.', 'sight_phrase_sentence', 'K', null)).toBe(true);
    expect(sentenceFits('The cat sat.', 'sight_phrase_sentence', 'K', null)).toBe(false);
  });
  it('no sentence opens with "Yes" or holds "my turn" (the tutor verdict openers)', () => {
    expect(sentenceFits('Yes the cat sat.', 'read_sentence', 'K', null)).toBe(false);
    for (const [mode, grade, parsed, ceiling] of CASES.map((c) => c.slice(1) as [SentenceMode, string, LetterScope | null, number])) {
      for (const t of texts(sentenceSpace(mode, grade, parsed, ceiling))) expect(/^yes\b|\bmy turn\b/i.test(t), t).toBe(false);
    }
  });
});

describe('di-sentence-reading sessions', () => {
  it.each(TIERS)('%s: each mode fills 6 distinct sentences inside the L4 band, shortest first, over 20 seeds', (tier) => {
    for (const [, mode, grade, parsed, ceiling] of CASES) for (let seed = 1; seed <= 20; seed++) {
      const band = resolveProblemShape(mode, tier, ceiling).band;
      const picks = drawSentences(mode, 6, grade, parsed, ceiling, band, mulberry32(seed), new Set());
      const where = `${mode} ${grade} ${parsed?.label} ${tier} seed ${seed}`;
      expect(picks, where).toHaveLength(6);
      expect(new Set(picks.map((p) => p.payload.text)).size).toBe(6);
      expect(picks.map((p) => p.payload.wordCount)).toEqual([...picks.map((p) => p.payload.wordCount)].sort((a, b) => a - b));
      // The band holds wherever the space has six sentences in it (group 1 has few long ones).
      const inBand = sentenceSpace(mode, grade, parsed, ceiling).filter((it) => it.payload.wordCount >= band[0] && it.payload.wordCount <= band[1]).length;
      if (inBand >= 6) for (const p of picks) expect(p.payload.wordCount, `${p.payload.text} (${where})`).toBeGreaterThanOrEqual(band[0]);
      if (inBand >= 6) for (const p of picks) expect(p.payload.wordCount).toBeLessThanOrEqual(band[1]);
      // Easy starts with the model card on screen: every item needs a different sentence sharing no word (R2).
      const items = buildSentenceReadingItems(picks.map((p, i) => asChallenge(p.payload, i, mode)));
      expect(items).toHaveLength(6);
      for (const item of items) expect(modelFor(item, items), `${item.text} (${where})`).not.toBeNull();
    }
  });
  it('K bands overlap (3-4, 4-5, 5-6): each tier targets its own length, and easy and medium share no sentence', () => {
    const bands = TIERS.map((t) => resolveProblemShape('decodable_sentence', t, 6).band);
    expect(TIERS.map((_, i) => bandTarget(bands, i))).toEqual([3, 5, 6]);
    const g1 = TIERS.map((t) => resolveProblemShape('decodable_sentence', t, 8).band);
    expect(TIERS.map((_, i) => bandTarget(g1, i))).toEqual([undefined, undefined, undefined]);
    for (const parsed of [GROUP2, scope('Letter-Sound Group 3: g, o, u, l, f, b'), SHORT_A]) for (let seed = 1; seed <= 10; seed++) {
      const [easy, medium] = [0, 1].map((t) => drawSentences('decodable_sentence', 4, 'K', parsed, 6, bands[t], mulberry32(seed), new Set(), bandTarget(bands, t))
        .map((p) => p.payload.text));
      expect(easy.filter((t) => medium.includes(t)), `${parsed?.label} seed ${seed}`).toEqual([]);
    }
  });
  it('two sessions at one tier differ', () => {
    const band = resolveProblemShape('decodable_sentence', 'medium', 6).band;
    const a = drawSentences('decodable_sentence', 4, 'K', SHORT_A, 6, band, mulberry32(1), new Set()).map((p) => p.payload.text);
    const b = drawSentences('decodable_sentence', 4, 'K', SHORT_A, 6, band, mulberry32(2), new Set()).map((p) => p.payload.text);
    expect(a).not.toEqual(b);
  });
});
