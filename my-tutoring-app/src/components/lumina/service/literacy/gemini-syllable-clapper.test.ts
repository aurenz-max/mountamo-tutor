import { describe, expect, it } from 'vitest';
import {
  resolveSyllableSupportScaffold,
  type SyllableSupportTier,
} from './gemini-syllable-clapper';

/**
 * Support-tier ladder for syllable-clapper (axis 3 — scaffolding withdrawal).
 *
 * ⚠ The NAME COLLISION is the thing these tests exist to protect: this
 * primitive's eval modes / `challengeType` values are literally
 * 'easy' | 'medium' | 'hard' (WORD LENGTH), and the support tier reuses those
 * same three words for a completely different axis (HOW MUCH HELP). The
 * resolver below takes the support tier ONLY — it has no access to
 * challengeType — which is what makes the two axes structurally orthogonal.
 */
describe('SyllableClapper support tiers — ladder', () => {
  it('withdraws the clap tally + the directional miss hint at hard only', () => {
    expect(resolveSyllableSupportScaffold('hard')).toEqual({
      showClapCounter: false,
      directionalErrorHint: false,
    });
  });

  it.each(['easy', 'medium'] as const)(
    'keeps full on-screen help at the %s tier',
    (tier) => {
      expect(resolveSyllableSupportScaffold(tier)).toEqual({
        showClapCounter: true,
        directionalErrorHint: true,
      });
    },
  );

  it('is monotone — no scaffold ever comes BACK as the tier rises', () => {
    const ladder: SyllableSupportTier[] = ['easy', 'medium', 'hard'];
    const scaffolds = ladder.map(resolveSyllableSupportScaffold);
    for (const key of ['showClapCounter', 'directionalErrorHint'] as const) {
      const seq = scaffolds.map((s) => s[key]);
      // Once a scaffold turns off it must stay off going up the ladder.
      const firstOff = seq.indexOf(false);
      if (firstOff !== -1) {
        expect(seq.slice(firstOff).every((v) => v === false)).toBe(true);
      }
    }
  });

  it('never returns fields that could re-band the CONTENT (word length is the eval mode, not the tier)', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const keys = Object.keys(resolveSyllableSupportScaffold(tier)).sort();
      expect(keys).toEqual(['directionalErrorHint', 'showClapCounter']);
      // Explicitly: nothing named like the content axis leaks out of the tier.
      expect(keys).not.toContain('challengeType');
      expect(keys).not.toContain('syllableCount');
      expect(keys).not.toContain('word');
      expect(keys).not.toContain('syllables');
    }
  });
});
