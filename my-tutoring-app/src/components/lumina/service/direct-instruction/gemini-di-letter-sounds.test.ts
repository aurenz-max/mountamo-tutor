import { describe, expect, it, vi } from 'vitest';

// Force the wrapper's Gemini call to fail so the generator falls back to its
// deterministic letter ladder (DEFAULT_LETTERS / text scan). This isolates the
// mode-BUILDING logic — the part /add-eval-modes added — from any network call.
// Pinned modes and explicit 'mixed' never call the LLM at all (see resolveEvalModes).
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn().mockRejectedValue(new Error('offline')) } },
}));

import { generateDiLetterSounds } from './gemini-di-letter-sounds';

const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const gen = (targetEvalMode: string) =>
  generateDiLetterSounds('letter sounds', 'kindergarten', {
    intent: 'letter sounds',
    targetEvalMode,
  });

describe('di-letter-sounds L1 eval-mode ladder', () => {
  it('pins letter_sound → every item is the base skill', async () => {
    const data = await gen('letter_sound');
    expect(data.challengeType).toBe('letter_sound');
    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
    expect(data.challenges.every((c) => c.challengeType === 'letter_sound')).toBe(true);
  });

  it('pins letter_sound_review → mixed set that broadens BEYOND the focused base cluster', async () => {
    const data = await gen('letter_sound_review');
    expect(data.challengeType).toBe('letter_sound_review');
    expect(data.challenges.every((c) => c.challengeType === 'letter_sound_review')).toBe(true);
    // Fallback focus is DEFAULT_LETTERS = m,s,a,f. Review must reach at least one
    // letter OUTSIDE that cluster, or it is indistinguishable from the base.
    const focus = new Set(['m', 's', 'a', 'f']);
    expect(data.challenges.some((c) => !focus.has(c.letter))).toBe(true);
  });

  it('pins first_sound_in_word → onset isolation over CONTINUANTS only (no short vowels)', async () => {
    const data = await gen('first_sound_in_word');
    expect(data.challengeType).toBe('first_sound_in_word');
    expect(data.challenges.every((c) => c.challengeType === 'first_sound_in_word')).toBe(true);
    expect(data.challenges.some((c) => VOWELS.includes(c.letter))).toBe(false);
  });

  it('mixed (explicit) → spreads across ALL THREE modes and staggers letters (SP-21)', async () => {
    const data = await gen('mixed');
    const types = new Set(data.challenges.map((c) => c.challengeType));
    expect(types).toEqual(new Set(['letter_sound', 'letter_sound_review', 'first_sound_in_word']));
    // The interleave must not stack one keyword across the modes of a round.
    const firstRound = data.challenges.slice(0, 3).map((c) => c.letter);
    expect(new Set(firstRound).size).toBe(firstRound.length);
  });
});
