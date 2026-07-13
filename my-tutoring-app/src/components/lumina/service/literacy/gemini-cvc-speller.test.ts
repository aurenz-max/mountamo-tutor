import { describe, expect, it } from 'vitest';
import { cvcRemediationMoveFor, resolveCvcVowelFocus } from './gemini-cvc-speller';

describe('CvcSpeller remediation affordances', () => {
  it.each([
    ['fill-vowel', 'contrast_vowel'],
    ['spell-word', 'phoneme_slots'],
    ['word-sort', 'minimal_pair_sort'],
  ] as const)('maps %s to its structural remediation move', (mode, expected) => {
    expect(cvcRemediationMoveFor(mode, 'The student confuses two vowel sounds.'))
      .toBe(expected);
  });

  it('leaves baseline generation untagged', () => {
    expect(cvcRemediationMoveFor('spell-word')).toBeUndefined();
    expect(cvcRemediationMoveFor('spell-word', '   ')).toBeUndefined();
  });
});

describe('CvcSpeller topic scope', () => {
  it('honors an explicit short-vowel topic', () => {
    expect(resolveCvcVowelFocus('Practice short-i CVC words')).toBe('short-i');
  });

  it('lets an explicit config declaration win', () => {
    expect(resolveCvcVowelFocus('short-i words', 'short-o')).toBe('short-o');
  });
});
