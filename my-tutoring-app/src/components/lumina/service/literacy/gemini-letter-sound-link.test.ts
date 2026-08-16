import { describe, expect, it } from 'vitest';
import {
  hearSeeContrastAvailable,
  isTargetableInMode,
  letterSoundRemediationMoveFor,
  retargetForMode,
} from './gemini-letter-sound-link';

/**
 * The DI content gate (2026-08-11). Live Gemini honored the prompt constraint
 * on all five real-pipeline probe runs, which means the code-side retarget is a
 * safety net that production traffic may never exercise — so it is exercised
 * here. What it protects: a `see-hear` item asks a five-year-old to produce a
 * sound ALONE, and only held sounds are benched for that (standing gate 1).
 */
describe('LetterSoundLink DI content gate', () => {
  const GROUP_1 = ['s', 'a', 't', 'i', 'p', 'n'];
  const GROUP_4 = [...GROUP_1, 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'qu'];

  it('refuses stops in see-hear and admits them everywhere else', () => {
    expect(isTargetableInMode('see-hear', 't')).toBe(false);
    expect(isTargetableInMode('see-hear', 's')).toBe(true);
    // The tutor makes the sound in hear-see, so a stop is fine there — this is
    // the coverage that makes the primitive more than a di-letter-sounds twin.
    expect(isTargetableInMode('hear-see', 't')).toBe(true);
    expect(isTargetableInMode('keyword-match', 't')).toBe(true);
  });

  it('refuses x in keyword-match — /ks/ never begins an English word', () => {
    expect(isTargetableInMode('keyword-match', 'x')).toBe(false);
    expect(isTargetableInMode('hear-see', 'x')).toBe(true);
  });

  it('refuses i in keyword-match too — the ask needs a PICTURE the child can name', () => {
    // The bar generalised from x when a probe drew `i` → "itch" → 🤏. The ask
    // is "say the picture word"; there is no answer a five-year-old can give,
    // so the tutor refuses every attempt. `i` keeps full coverage in the two
    // directions whose answer is a held sound or a tap.
    expect(isTargetableInMode('keyword-match', 'i')).toBe(false);
    expect(isTargetableInMode('see-hear', 'i')).toBe(true);
    expect(isTargetableInMode('hear-see', 'i')).toBe(true);
  });

  it('retargets a stop draw onto a held sound inside the same group', () => {
    const replacement = retargetForMode('see-hear', GROUP_1, new Set());
    expect(replacement).not.toBeNull();
    expect(isTargetableInMode('see-hear', replacement!)).toBe(true);
    expect(GROUP_1).toContain(replacement);
  });

  it('prefers a letter the session has not used yet (N challenges = N problems)', () => {
    expect(retargetForMode('see-hear', GROUP_1, new Set(['s', 'a']))).toBe('i');
    expect(retargetForMode('keyword-match', GROUP_4, new Set(['s']))).toBe('a');
  });

  it('falls back rather than inventing an out-of-group letter when the pool is spent', () => {
    const spent = new Set(GROUP_1);
    const replacement = retargetForMode('see-hear', GROUP_1, spent);
    expect(GROUP_1).toContain(replacement);
  });

  it('leaves the challenge alone when a mode has no legal target in the group', () => {
    // A group of nothing but stops has no see-hear item to offer.
    expect(retargetForMode('see-hear', ['t', 'p', 'b'], new Set())).toBeNull();
  });
});

describe('LetterSoundLink remediation affordances', () => {
  it.each([
    ['see-hear', 'contrast_sound'],
    ['hear-see', 'contrast_letter'],
    ['keyword-match', 'contrast_keyword'],
  ] as const)('maps %s to its structural remediation move', (mode, expected) => {
    expect(letterSoundRemediationMoveFor(mode, 'The student confuses two letter sounds.')).toBe(expected);
  });

  it('leaves baseline generation untagged', () => {
    expect(letterSoundRemediationMoveFor('see-hear')).toBeUndefined();
  });

  it('abstains when a diagnosed hear-see contrast falls outside the cumulative group', () => {
    const focus = 'The student confuses the letter T and its sound with the letter D and its sound.';
    expect(hearSeeContrastAvailable(focus, ['s', 'a', 't', 'i', 'p', 'n'])).toBe(false);
    expect(letterSoundRemediationMoveFor('hear-see', focus, false)).toBeUndefined();
  });

  it('allows a diagnosed hear-see contrast when both letters are in scope', () => {
    const focus = 'The student confuses letter T with letter D.';
    expect(hearSeeContrastAvailable(focus, ['s', 'a', 't', 'i', 'p', 'n', 'd'])).toBe(true);
  });
});
