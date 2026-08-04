/**
 * L4 structural difficulty for di-letter-sounds: the tier's SECOND dial —
 * whole-session item-set composition. The wrapper model is advisory; these
 * tests exercise the deterministic count → honor → reconstruct path.
 */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import {
  generateDiLetterSounds,
  resolveProblemShape,
} from './gemini-di-letter-sounds';
import type { DiLetterSoundsSupportTier } from '../../primitives/visual-primitives/direct-instruction/diLetterSoundsScript';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const PAIRS = [['m', 'n'], ['f', 'v']] as const;
const TIERS: DiLetterSoundsSupportTier[] = ['easy', 'medium', 'hard'];
const MODES = ['letter_sound', 'letter_sound_review', 'first_sound_in_word', 'mixed'] as const;

const gen = (mode: string, difficulty?: string, challengeCount = 4, intent = 'letter sounds') =>
  generateDiLetterSounds(intent, 'kindergarten', {
    intent,
    targetEvalMode: mode,
    challengeCount,
    ...(difficulty ? { difficulty } : {}),
  });

const letters = (data: Awaited<ReturnType<typeof generateDiLetterSounds>>) =>
  data.challenges.map((c) => c.letter);
const vowelCount = (xs: readonly string[]) => xs.filter((x) => VOWELS.has(x)).length;
const pairCount = (xs: readonly string[]) => {
  const set = new Set(xs);
  return PAIRS.filter(([a, b]) => set.has(a) && set.has(b)).length;
};

describe('resolveProblemShape — floors and caps', () => {
  it('keeps item count out of the difficulty dial and clamps pair targets to capacity', () => {
    expect(resolveProblemShape('letter_sound', 'hard', 3).confusablePairTarget).toBe(1);
    expect(resolveProblemShape('letter_sound', 'hard', 4).confusablePairTarget).toBe(2);
    expect(resolveProblemShape('letter_sound', 'hard', 99).confusablePairTarget).toBe(2);
  });

  it('onset medium honestly saturates because its identity forbids short vowels', () => {
    const shape = resolveProblemShape('first_sound_in_word', 'medium', 4);
    expect(shape.minimumShortVowels).toBe(0);
    expect(shape.maximumShortVowels).toBe(0);
    expect(shape.confusablePairTarget).toBe(0);
    expect(shape.saturated).toBe(true);
  });
});

describe('tier composition, pinned base and review modes', () => {
  for (const mode of ['letter_sound', 'letter_sound_review'] as const) {
    it(`${mode}: easy is unique continuants with no complete contrast pair`, async () => {
      const xs = letters(await gen(mode, 'easy'));
      expect(new Set(xs).size).toBe(xs.length);
      expect(vowelCount(xs)).toBe(0);
      expect(pairCount(xs)).toBe(0);
    });

    it(`${mode}: medium adds a short vowel but not a confusable pair`, async () => {
      const xs = letters(await gen(mode, 'medium'));
      expect(new Set(xs).size).toBe(xs.length);
      expect(vowelCount(xs)).toBeGreaterThanOrEqual(1);
      expect(pairCount(xs)).toBe(0);
    });

    it(`${mode}: hard puts both confusable pairs in the four-item set`, async () => {
      const xs = letters(await gen(mode, 'hard'));
      expect(new Set(xs)).toEqual(new Set(['m', 'n', 'f', 'v']));
      expect(pairCount(xs)).toBe(2);
    });
  }
});

describe('onset identity cap and honest saturation', () => {
  it('easy and medium both remain continuant-only and pair-free', async () => {
    const easy = letters(await gen('first_sound_in_word', 'easy'));
    const medium = letters(await gen('first_sound_in_word', 'medium'));
    expect(medium).toEqual(easy);
    expect(vowelCount(medium)).toBe(0);
    expect(pairCount(medium)).toBe(0);
  });

  it('hard uses confusable continuants without crossing into vowel onset', async () => {
    const xs = letters(await gen('first_sound_in_word', 'hard'));
    expect(vowelCount(xs)).toBe(0);
    expect(pairCount(xs)).toBe(2);
  });
});

describe('mixed-mode variance window', () => {
  it('easy composition survives per-mode focus rotation', async () => {
    const data = await gen('mixed', 'easy');
    const xs = letters(data);
    expect(new Set(data.challenges.map((c) => c.challengeType)).size).toBe(3);
    expect(new Set(xs).size).toBe(xs.length);
    expect(vowelCount(xs)).toBe(0);
    expect(pairCount(xs)).toBe(0);
  });

  it('medium composition survives rotation and tiers every identity', async () => {
    const data = await gen('mixed', 'medium');
    const xs = letters(data);
    expect(vowelCount(xs)).toBeGreaterThanOrEqual(1);
    expect(pairCount(xs)).toBe(0);
    expect(data.challenges.every((c) => c.supportTier === 'medium')).toBe(true);
  });

  it('hard pair window survives rotation while every eval-mode slot stays intact', async () => {
    const data = await gen('mixed', 'hard');
    const xs = letters(data);
    expect(pairCount(xs)).toBe(2);
    expect(new Set(data.challenges.map((c) => c.challengeType))).toEqual(
      new Set(['letter_sound', 'letter_sound_review', 'first_sound_in_word']),
    );
  });
});

describe('capacity stress and no-tier guardrail', () => {
  it('hits the exact target across every mode × tier × supported item count', async () => {
    for (const mode of MODES) {
      for (const tier of TIERS) {
        for (let count = 3; count <= 6; count++) {
          const data = await gen(mode, tier, count);
          const xs = letters(data);
          const shape = resolveProblemShape(mode, tier, count);
          expect(xs).toHaveLength(count);
          expect(new Set(xs).size).toBe(count);
          expect(vowelCount(xs)).toBeGreaterThanOrEqual(shape.minimumShortVowels);
          expect(vowelCount(xs)).toBeLessThanOrEqual(shape.maximumShortVowels);
          expect(pairCount(xs)).toBe(shape.confusablePairTarget);
          expect(data.challenges.every((c) => c.supportTier === tier)).toBe(true);
        }
      }
    }
  });

  it('stress: 2,048 varied objective sets stay exact, unique, and in-mode', async () => {
    const menu = ['m', 's', 'f', 'r', 'n', 'l', 'v', 'z', 'a', 'e', 'i', 'o', 'u'];
    let state = 0x51f15e;
    for (let run = 0; run < 2048; run++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const mode = MODES[state % MODES.length];
      const tier = TIERS[(state >>> 3) % TIERS.length];
      const count = 3 + ((state >>> 6) % 4);
      const focusCount = 1 + ((state >>> 9) % 6);
      const offset = (state >>> 13) % menu.length;
      const focus = Array.from(
        { length: focusCount },
        (_, i) => menu[(offset + i * 5) % menu.length],
      ).join(' ');
      const data = await gen(mode, tier, count, `letter sounds ${focus}`);
      const xs = letters(data);
      const shape = resolveProblemShape(mode, tier, count);

      expect(xs).toHaveLength(count);
      expect(new Set(xs).size).toBe(count);
      expect(vowelCount(xs)).toBeGreaterThanOrEqual(shape.minimumShortVowels);
      expect(vowelCount(xs)).toBeLessThanOrEqual(shape.maximumShortVowels);
      expect(pairCount(xs)).toBe(shape.confusablePairTarget);
      if (mode === 'first_sound_in_word') {
        expect(data.challenges.every((c) => c.challengeType === mode)).toBe(true);
      }
    }
  });

  it('no difficulty remains the pre-L4 path — no tier and no forced hard pairs', async () => {
    const data = await gen('letter_sound');
    expect(letters(data)).toEqual(['m', 's', 'a', 'f']);
    expect(data.challenges.every((c) => c.supportTier === undefined)).toBe(true);
  });

  it('the tier reaches the advisory prompt as well as code enforcement', async () => {
    mocks.generateContent.mockClear();
    await gen('letter_sound', 'hard');
    expect(mocks.generateContent).toHaveBeenCalled();
    const call = mocks.generateContent.mock.calls.at(-1)?.[0] as { contents?: string } | undefined;
    expect(call?.contents).toContain('DIFFICULTY TIER (hard)');
    expect(call?.contents).toContain('m/n and f/v');
  });
});
