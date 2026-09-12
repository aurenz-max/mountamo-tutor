import { describe, expect, it } from 'vitest';
import {
  resolveSyllableSupportScaffold,
  type SyllableSupportTier,
} from './gemini-syllable-clapper';

/**
 * Support-tier ladder for syllable-clapper — scaffolding withdrawal AND word
 * length, which are the same axis and now say so.
 *
 * ⭐ THE NAME COLLISION THESE TESTS USED TO PROTECT IS GONE, AND THE REASON IS
 * WORTH KEEPING. Until 2026-09-11 the eval modes were literally
 * 'easy' | 'medium' | 'hard' — WORD LENGTH registered as three skills — while
 * the support tier reused those same three words for HOW MUCH HELP, so every
 * test here had to prove the two could not contaminate each other. The modes
 * are now the three ACTS (blending, counting, deleting) and length moved onto
 * the tier where it belonged, so the collision has no surface left. What the
 * tier must still never touch is the ACT and the content it is made of, which
 * is what the last test below pins.
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
      band: 'hard',
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

  it('carries the word-length band — the third lever, and the one that moved here', () => {
    // Length is how hard an instance of ONE act is, which is the tier's job. It
    // was an eval mode until 2026-09-11, which made one act look like three
    // skills; the modes are the acts now.
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      expect(resolveSyllableSupportScaffold(tier).band).toBe(tier);
    }
  });

  it('never returns a field that could change the ACT or the content it is made of', () => {
    // The rule the retired name-collision tests were really protecting: a tier
    // withdraws help and shortens words, and it may never decide WHICH SKILL the
    // child is practising or rewrite the item it is practising on.
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const keys = Object.keys(resolveSyllableSupportScaffold(tier)).sort();
      expect(keys).toEqual(['band', 'echoWordSlowly', 'inviteClap']);
      expect(keys).not.toContain('challengeType');
      expect(keys).not.toContain('syllableCount');
      expect(keys).not.toContain('word');
      expect(keys).not.toContain('syllables');
      expect(keys).not.toContain('removePart');
      expect(keys).not.toContain('residue');
    }
  });
});
