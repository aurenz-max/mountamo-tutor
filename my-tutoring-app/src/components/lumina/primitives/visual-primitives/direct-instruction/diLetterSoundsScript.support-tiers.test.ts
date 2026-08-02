/**
 * L3 support tiers for di-letter-sounds. The whole ladder is
 * instruction-as-scaffold (modality #2): a tier withdraws DISTAR sub-steps from
 * the SPOKEN cue and changes nothing else. These tests pin both halves of that
 * claim — what withdraws, and what must NOT.
 *
 * The pack-specific assertions the two sibling suites don't have: the three
 * eval modes carry DIFFERENT cue structures (isolated continuant / keyword
 * vowel / onset-from-a-word), so `hard` must compose per-mode without breaking
 * either inversion — the onset ask still speaks the stimulus WORD while its
 * first sound never precedes the attempt, and the keyword-vowel ask still
 * speaks the keyword while the model's sound-naming ("short a") withdraws.
 */

import { describe, it, expect } from 'vitest';
import {
  itemCue,
  moveOnCue,
  correctionLine,
  verifyLine,
  testLine,
  type DiLetterSoundChallenge,
  type DiLetterSoundsSupportTier,
} from './diLetterSoundsScript';

/** m → "mmm" as in "moon" — the base isolated continuant. The sound token
 *  "mmm" appears nowhere in the test line, so a `toContain('mmm')` hit in a
 *  hard spoken block can only come from a leaked model/guide. */
const continuant = (
  supportTier?: DiLetterSoundsSupportTier,
  overrides: Partial<DiLetterSoundChallenge> = {},
): DiLetterSoundChallenge => ({
  id: 'dils-1-m',
  challengeType: 'letter_sound',
  letter: 'm',
  spoken: 'mmm',
  keyword: 'moon',
  emoji: '🌙',
  elicitation: 'isolated',
  ...(supportTier ? { supportTier } : {}),
  ...overrides,
});

/** a → keyword elicitation through "apple" (vowels distort in isolation). */
const vowel = (supportTier?: DiLetterSoundsSupportTier): DiLetterSoundChallenge => ({
  id: 'dils-2-a',
  challengeType: 'letter_sound',
  letter: 'a',
  spoken: 'aaa',
  keyword: 'apple',
  emoji: '🍎',
  elicitation: 'keyword',
  ...(supportTier ? { supportTier } : {}),
});

/** Onset isolation: the tutor says "moon", the child produces its FIRST sound.
 *  The word is the stimulus and stays in the ask at every tier. */
const onset = (supportTier?: DiLetterSoundsSupportTier): DiLetterSoundChallenge => ({
  id: 'dils-3-m',
  challengeType: 'first_sound_in_word',
  letter: 'm',
  spoken: 'mmm',
  keyword: 'moon',
  emoji: '🌙',
  elicitation: 'isolated',
  ...(supportTier ? { supportTier } : {}),
});

/** s → "sss" as in "sun" for the move-on target. */
const nextItem = (supportTier?: DiLetterSoundsSupportTier): DiLetterSoundChallenge => ({
  id: 'dils-4-s',
  challengeType: 'letter_sound_review',
  letter: 's',
  spoken: 'sss',
  keyword: 'sun',
  emoji: '☀️',
  elicitation: 'isolated',
  ...(supportTier ? { supportTier } : {}),
});

/** The block the tutor is told to "Speak exactly" — everything it may say. */
const spokenBlock = (cue: string): string => {
  const m = cue.match(/Speak exactly:\n"([\s\S]*?)"/);
  if (!m) throw new Error(`no spoken block in cue:\n${cue}`);
  return m[1];
};

describe('di-letter-sounds support tiers — the DISTAR ladder', () => {
  it('easy hands over the FULL sequence: model + guide + test', () => {
    const spoken = spokenBlock(itemCue(continuant('easy')));
    expect(spoken).toContain('This sound is mmm, as in moon. Listen: mmm.');
    expect(spoken).toContain('Together: mmm, as in moon.');
    expect(spoken).toContain('Your turn. What sound?');
  });

  it('medium withdraws the choral guide but keeps the model', () => {
    const spoken = spokenBlock(itemCue(continuant('medium')));
    expect(spoken).toContain('Listen: mmm.');
    expect(spoken).not.toContain('Together:');
    expect(spoken).toContain('Your turn. What sound?');
  });

  it('hard is a COLD production — the tutor is given nothing to say but the ask', () => {
    const spoken = spokenBlock(itemCue(continuant('hard')));
    expect(spoken).not.toContain('Listen:');
    expect(spoken).not.toContain('Together:');
    expect(spoken.trim()).toBe('Your turn. What sound?');
  });

  it('hard NEVER puts the SOUND in the spoken block (the point of the tier)', () => {
    // The model line is the echo route: it speaks the very sound the child is
    // about to produce. At hard the sound exists only on the child's screen as
    // a grapheme — the item is a genuine grapheme→sound retrieval probe. The
    // judging contract still carries it, because judging never changes with tier.
    const cue = itemCue(continuant('hard'));
    expect(spokenBlock(cue)).not.toContain('mmm');
    expect(cue).toContain('mmm'); // still judged against it
    expect(cue).toContain('answering this one cold on purpose');
  });

  it('an absent tier behaves exactly as easy (pre-L3 sessions are unchanged)', () => {
    expect(itemCue(continuant(undefined))).toBe(itemCue(continuant('easy')));
    expect(itemCue(vowel(undefined))).toBe(itemCue(vowel('easy')));
    expect(itemCue(onset(undefined))).toBe(itemCue(onset('easy')));
  });

  it('the opening cue carries the tier too', () => {
    const spoken = spokenBlock(itemCue(continuant('hard'), true));
    expect(spoken.trim()).toBe('Your turn. What sound?');
    expect(itemCue(continuant('hard'), true)).toContain('brisk kindergarten letter-sounds practice');
  });

  it('the ladder composes per-mode — every task identity reduces to its own ask at hard', () => {
    for (const item of [continuant('hard'), vowel('hard'), onset('hard')]) {
      const spoken = spokenBlock(itemCue(item));
      expect(spoken.trim()).toBe(testLine(item));
    }
  });

  it('onset inversion holds at hard: the WORD stays in the ask, its first sound never does', () => {
    // first_sound_in_word has no printed grapheme — the spoken word IS the
    // stimulus, so withdrawing it would change the task identity. What hard
    // withholds is the onset itself ("Moon starts with mmm.").
    const spoken = spokenBlock(itemCue(onset('hard')));
    expect(spoken).toContain('moon');
    expect(spoken).not.toContain('mmm');
    expect(spoken).not.toContain('starts with');
  });

  it('keyword-vowel nuance at hard: the keyword stays in the ask, the sound-naming withdraws', () => {
    // Vowels elicit through the keyword, so "Your turn. Say apple." must keep
    // speaking it at every tier. What hard withdraws is the model's explicit
    // grapheme→sound link ("The first sound in apple is short a").
    const spoken = spokenBlock(itemCue(vowel('hard')));
    expect(spoken.trim()).toBe('Your turn. Say apple.');
    expect(spoken).not.toContain('short');
    expect(spoken).not.toContain('first sound in');
    expect(spoken).not.toContain('aaa');
  });
});

describe('di-letter-sounds support tiers — what must NOT change', () => {
  const tiers: DiLetterSoundsSupportTier[] = ['easy', 'medium', 'hard'];

  it('the CORRECTION re-models the sound at every tier (standing gate 3)', () => {
    // Remediation is not scaffolding: DISTAR always re-models on an error, so a
    // hard tier withholds the up-front model and still re-states on a miss.
    // This pack carries the PLAIN correction only — the contrastive port is
    // frozen on HUMAN-CHECKS #55 (family rule) — so the line is byte-pinned.
    for (const tier of tiers) {
      expect(correctionLine(continuant(tier)))
        .toBe('My turn: mmm, as in moon. Your turn. What sound?');
      expect(correctionLine(onset(tier)))
        .toBe('My turn: moon starts with mmm. Your turn. What is the first sound in moon?');
      expect(correctionLine(vowel(tier)))
        .toBe('My turn: apple. Your turn. Say apple.');
    }
  });

  it('the restating AFFIRM is identical at every tier', () => {
    for (const tier of tiers) {
      expect(verifyLine(continuant(tier))).toBe('Yes, mmm.');
      expect(verifyLine(vowel(tier))).toBe('Yes. Apple starts with short a.');
      expect(verifyLine(onset(tier))).toBe('Yes, mmm.');
    }
  });

  it('the judging contract is byte-identical across tiers', () => {
    // A tier changes how much help precedes the attempt — never how it is
    // judged. If this drifts, the tiers stop being comparable evidence.
    for (const make of [continuant, vowel, onset]) {
      const contractOf = (tier: DiLetterSoundsSupportTier) =>
        itemCue(make(tier)).split('Then wait for the learner.')[1];
      expect(contractOf('medium')).toBe(contractOf('easy'));
      expect(contractOf('hard')).toBe(contractOf('easy'));
    }
  });

  it('the item itself is untouched by tier — support moves, content does not', () => {
    for (const tier of tiers) {
      const ch = continuant(tier);
      expect(ch.letter).toBe('m');
      expect(ch.spoken).toBe('mmm');
      expect(ch.keyword).toBe('moon');
    }
  });
});

describe('di-letter-sounds support tiers — move-on cue', () => {
  it("composes the NEXT item at the NEXT item's tier", () => {
    const spoken = spokenBlock(moveOnCue(continuant('easy'), nextItem('hard')));
    expect(spoken).toContain('Good try.');
    expect(spoken).not.toContain('Listen:');
    expect(spoken).not.toContain('sss'); // the next item's sound stays unsaid
    expect(spoken).toContain('Your turn. What sound?');
  });

  it('still models the next item at easy', () => {
    const spoken = spokenBlock(moveOnCue(continuant('hard'), nextItem('easy')));
    expect(spoken).toContain('This sound is sss, as in sun. Listen: sss.');
    expect(spoken).toContain('Together: sss, as in sun.');
  });

  it('the final move-on (no next item) closes the session at any tier', () => {
    expect(moveOnCue(continuant('hard'))).toContain("That's the end of our practice.");
  });
});
