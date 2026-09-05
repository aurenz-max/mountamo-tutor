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

  it('a pinned mode + hard stamps EVERY challenge hard', async () => {
    const hard = await genTiered('letter_sound', 'hard');
    expect(hard.challenges.every((c) => c.supportTier === 'hard')).toBe(true);
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

// ── The objective is the scope contract (2026-09-05) ──────────────────────
// A lesson-journey run found a Group 1 objective ("s, a, t, i, p, n") drilling
// s, n, f, r: the easy tier evicted a and i, the count came from a default, and
// the backfill left the set. The manifest passed the objective; the generator
// now reads it.
const GROUP_1 = `Letter-Sound Group 1: s, a, t, i, p, n

**Full Practice Set (Cumulative):**
s, a, t, i, p, n

**Focus:** Produce the correct, most common sound for each letter in the set when shown the grapheme. For example, when shown 'a', the student says /ă/ (as in 'apple'). It is crucial to teach clean sounds (e.g., a crisp /t/ sound, not "tuh").`;
const GROUP_2 = `Letter-Sound Group 2: c, k, e, h, r, m, d

**Full Practice Set (Cumulative):**
s, a, t, i, p, n, c, k, e, h, r, m, d`;

describe('di-letter-sounds reads the objective it was handed', () => {
  it('Group 1 at easy drills the set\'s menu letters only and reports the stops', async () => {
    const data = await generateDiLetterSounds('Phonics 1', 'kindergarten', {
      intent: 'Letter-Sound Group 1', objectiveText: GROUP_1, targetEvalMode: 'letter_sound', difficulty: 'easy', count: 6,
    });
    const letters = data.challenges.map((c) => c.letter);
    expect(letters.sort()).toEqual(['a', 'i', 'n', 's']);
    expect(data.unaskableLetters).toEqual(['t', 'p']);
    expect(data.challenges.every((c) => c.supportTier === 'easy')).toBe(true);
  });
  it('Group 2 at hard never leaves the cumulative set for a confusable pair', async () => {
    const data = await generateDiLetterSounds('Phonics 2', 'kindergarten', {
      intent: 'Letter-Sound Group 2', objectiveText: GROUP_2, targetEvalMode: 'letter_sound', difficulty: 'hard', count: 6,
    });
    const letters = data.challenges.map((c) => c.letter);
    expect(letters).toHaveLength(6);
    expect(letters.every((l) => ['s', 'a', 'i', 'n', 'e', 'r', 'm'].includes(l))).toBe(true);
    expect(letters).not.toContain('v');
    expect(letters).not.toContain('f');
  });
  it('an "assess without first saying its sound" objective withdraws the model whatever the manifest tier says', async () => {
    const data = await generateDiLetterSounds('Phonics 1', 'kindergarten', {
      intent: 'assess', targetEvalMode: 'letter_sound', difficulty: 'medium', count: 4,
      objectiveText: 'Independently produce the most common sound for each letter in this cumulative set, when shown its grapheme. Assess without first saying its sound: s, a, t, i, p, n.',
    });
    expect(data.challenges.every((c) => c.supportTier === 'hard')).toBe(true);
  });
  it('honors the manifest\'s `count` when no set is named', async () => {
    const data = await generateDiLetterSounds('letter sounds', 'kindergarten', { intent: 'letter sounds', targetEvalMode: 'letter_sound', count: 6 });
    expect(data.challenges).toHaveLength(6);
    expect(data.unaskableLetters).toBeUndefined();
  });
});
