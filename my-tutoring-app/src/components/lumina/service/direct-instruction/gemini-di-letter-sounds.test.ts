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

describe('di-letter-sounds L3 support tier (config.difficulty)', () => {
  const genTiered = (targetEvalMode: string, difficulty?: string) =>
    generateDiLetterSounds('letter sounds', 'kindergarten', {
      intent: 'letter sounds',
      targetEvalMode,
      ...(difficulty !== undefined ? { difficulty } : {}),
    });

  it('a pinned mode + hard stamps EVERY challenge hard, letters untouched', async () => {
    const plain = await genTiered('letter_sound');
    const hard = await genTiered('letter_sound', 'hard');
    expect(hard.challenges.every((c) => c.supportTier === 'hard')).toBe(true);
    // The tier never changes which letters are drawn — same deterministic
    // fallback ladder, same selection (offline path is order-stable).
    expect(hard.challenges.map((c) => c.letter)).toEqual(plain.challenges.map((c) => c.letter));
  });

  it('mixed + medium tiers ALL THREE identities (gate on tier presence, never a pinned mode)', async () => {
    const data = await genTiered('mixed', 'medium');
    const types = new Set(data.challenges.map((c) => c.challengeType));
    expect(types.size).toBe(3);
    expect(data.challenges.every((c) => c.supportTier === 'medium')).toBe(true);
  });

  it('no difficulty param → no supportTier field at all (pre-L3 byte-compatible)', async () => {
    const data = await genTiered('letter_sound');
    expect(data.challenges.every((c) => !('supportTier' in c))).toBe(true);
  });

  it('an unknown difficulty value is ignored, not coerced', async () => {
    const data = await genTiered('letter_sound', 'extreme');
    expect(data.challenges.every((c) => !('supportTier' in c))).toBe(true);
  });
});
