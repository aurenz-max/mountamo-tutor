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
 *
 * ⭐ THE LEVERS MOVED WITH THE DI PORT and the intent moved with them. The click
 * era withdrew a 6-circle clap TALLY and a directional miss hint ("too many
 * claps"); both surfaces are deleted, because the tally printed the count the
 * child was supposed to hold and a direction turns a 1-to-4 answer space into a
 * binary search. What a spoken listening task actually has to withdraw is THE
 * TUTOR'S ENUNCIATION and the motor scaffold, so that is what the ladder now
 * resolves. The asks those flags produce are pinned in
 * `SyllableClapper.di-script.test.ts`.
 */
describe('SyllableClapper support tiers — ladder', () => {
  it('withdraws the slower second saying above the easy tier', () => {
    expect(resolveSyllableSupportScaffold('easy').echoWordSlowly).toBe(true);
    expect(resolveSyllableSupportScaffold('medium').echoWordSlowly).toBe(false);
    expect(resolveSyllableSupportScaffold('hard').echoWordSlowly).toBe(false);
  });

  it('withdraws the clap invitation — the motor scaffold — at hard only', () => {
    expect(resolveSyllableSupportScaffold('hard')).toEqual({
      echoWordSlowly: false,
      inviteClap: false,
    });
    expect(resolveSyllableSupportScaffold('easy').inviteClap).toBe(true);
    expect(resolveSyllableSupportScaffold('medium').inviteClap).toBe(true);
  });

  it('is monotone — no scaffold ever comes BACK as the tier rises', () => {
    const ladder: SyllableSupportTier[] = ['easy', 'medium', 'hard'];
    const scaffolds = ladder.map(resolveSyllableSupportScaffold);
    for (const key of ['echoWordSlowly', 'inviteClap'] as const) {
      const seq = scaffolds.map((s) => s[key]);
      const firstOff = seq.indexOf(false);
      if (firstOff !== -1) {
        expect(seq.slice(firstOff).every((v) => v === false)).toBe(true);
      }
    }
  });

  it('every rung differs from its neighbour — three tiers, not two wearing three names', () => {
    // The click-era ladder resolved easy and medium IDENTICALLY, so two of the
    // three IRT support rungs were the same activity. The enunciation ladder has
    // a distinct rung at each level.
    const [easy, medium, hard] = (['easy', 'medium', 'hard'] as const)
      .map(resolveSyllableSupportScaffold);
    expect(easy).not.toEqual(medium);
    expect(medium).not.toEqual(hard);
  });

  it('never returns fields that could re-band the CONTENT (word length is the eval mode, not the tier)', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const keys = Object.keys(resolveSyllableSupportScaffold(tier)).sort();
      expect(keys).toEqual(['echoWordSlowly', 'inviteClap']);
      // Explicitly: nothing named like the content axis leaks out of the tier.
      expect(keys).not.toContain('challengeType');
      expect(keys).not.toContain('syllableCount');
      expect(keys).not.toContain('word');
      expect(keys).not.toContain('syllables');
    }
  });
});
