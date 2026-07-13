import { describe, expect, it } from 'vitest';
import { hearSeeContrastAvailable, letterSoundRemediationMoveFor } from './gemini-letter-sound-link';

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
