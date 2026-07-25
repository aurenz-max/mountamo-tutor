/**
 * L3 support tiers for di-sentence-reading. The whole ladder is
 * instruction-as-scaffold (modality #2): a tier withdraws DISTAR sub-steps from
 * the SPOKEN cue and changes nothing else. These tests pin both halves of that
 * claim — what withdraws, and what must NOT.
 */

import { describe, it, expect } from 'vitest';
import {
  itemCue,
  moveOnCue,
  correctionLine,
  verifyLine,
  type DiSentenceReadingChallenge,
  type DiSentenceReadingSupportTier,
} from './diSentenceReadingScript';

const SENTENCE = 'The red hen ran.';

const challenge = (
  supportTier?: DiSentenceReadingSupportTier,
  text = SENTENCE,
  id = 'disr-1-red-hen',
): DiSentenceReadingChallenge => ({
  id,
  challengeType: 'read_sentence',
  text,
  wordCount: text.trim().split(/\s+/).length,
  ...(supportTier ? { supportTier } : {}),
});

/** The block the tutor is told to "Speak exactly" — everything it may say. */
const spokenBlock = (cue: string): string => {
  const m = cue.match(/Speak exactly:\n"([\s\S]*?)"/);
  if (!m) throw new Error(`no spoken block in cue:\n${cue}`);
  return m[1];
};

describe('di-sentence-reading support tiers — the DISTAR ladder', () => {
  it('easy hands over the FULL sequence: model + guide + test', () => {
    const spoken = spokenBlock(itemCue(challenge('easy')));
    expect(spoken).toContain(`Listen: ${SENTENCE}`);
    expect(spoken).toContain(`Together: ${SENTENCE}`);
    expect(spoken).toContain('Your turn. Read it.');
  });

  it('medium withdraws the choral guide but keeps the model', () => {
    const spoken = spokenBlock(itemCue(challenge('medium')));
    expect(spoken).toContain(`Listen: ${SENTENCE}`);
    expect(spoken).not.toContain('Together:');
    expect(spoken).toContain('Your turn. Read it.');
  });

  it('hard is a COLD read — the tutor is given nothing to say but the ask', () => {
    const spoken = spokenBlock(itemCue(challenge('hard')));
    expect(spoken).not.toContain('Listen:');
    expect(spoken).not.toContain('Together:');
    expect(spoken.trim()).toBe('Your turn. Read it.');
  });

  it('hard NEVER puts the sentence in the spoken block (the point of the tier)', () => {
    // The strongest assertion here: at `hard` the child must decode print with
    // no echo route, so the target sentence must not appear anywhere the tutor
    // is permitted to speak — even though the judging contract still carries it.
    const cue = itemCue(challenge('hard'));
    expect(spokenBlock(cue)).not.toContain(SENTENCE);
    expect(cue).toContain(SENTENCE); // still judged against it
    expect(cue).toContain('reading this one cold on purpose');
  });

  it('an absent tier behaves exactly as easy (pre-L3 sessions are unchanged)', () => {
    expect(spokenBlock(itemCue(challenge(undefined)))).toBe(
      spokenBlock(itemCue(challenge('easy'))),
    );
  });

  it('the opening cue carries the tier too', () => {
    const spoken = spokenBlock(itemCue(challenge('hard'), true));
    expect(spoken.trim()).toBe('Your turn. Read it.');
    expect(itemCue(challenge('hard'), true)).toContain('no greeting, no introduction');
  });
});

describe('di-sentence-reading support tiers — what must NOT change', () => {
  const tiers: DiSentenceReadingSupportTier[] = ['easy', 'medium', 'hard'];

  it('the CORRECTION re-models at every tier (standing gate 3)', () => {
    // Remediation is not scaffolding: DISTAR always re-models on an error, so a
    // hard tier withholds the up-front model and still re-reads on a miss.
    for (const tier of tiers) {
      const line = correctionLine(challenge(tier));
      expect(line).toBe(`My turn: ${SENTENCE} Your turn. Read it again.`);
      expect(line).toContain(SENTENCE);
    }
  });

  it('the restating AFFIRM is identical at every tier (bench question (c))', () => {
    for (const tier of tiers) {
      expect(verifyLine(challenge(tier))).toBe(`Yes, that says ${SENTENCE}`);
    }
  });

  it('the judging contract is byte-identical across tiers', () => {
    // A tier changes how much help precedes the read — never how the read is
    // judged. If this drifts, the tiers stop being comparable evidence.
    const contractOf = (tier: DiSentenceReadingSupportTier) =>
      itemCue(challenge(tier)).split('Then wait for the learner.')[1];
    expect(contractOf('medium')).toBe(contractOf('easy'));
    expect(contractOf('hard')).toBe(contractOf('easy'));
  });

  it('the sentence itself is untouched by tier — support moves, content does not', () => {
    for (const tier of tiers) {
      const ch = challenge(tier);
      expect(ch.text).toBe(SENTENCE);
      expect(ch.wordCount).toBe(4);
    }
  });
});

describe('di-sentence-reading support tiers — move-on cue', () => {
  it('composes the NEXT item at the NEXT item\'s tier', () => {
    const spoken = spokenBlock(moveOnCue(challenge('easy'), challenge('hard', 'The cat sat.', 'disr-2-cat-sat')));
    expect(spoken).toContain('Good try.');
    expect(spoken).not.toContain('Listen:');
    expect(spoken).not.toContain('The cat sat.');
    expect(spoken).toContain('Your turn. Read it.');
  });

  it('still models the next item at easy', () => {
    const spoken = spokenBlock(moveOnCue(challenge('hard'), challenge('easy', 'The cat sat.', 'disr-2-cat-sat')));
    expect(spoken).toContain('Listen: The cat sat.');
    expect(spoken).toContain('Together: The cat sat.');
  });

  it('the final move-on (no next item) closes the session at any tier', () => {
    expect(moveOnCue(challenge('hard'))).toContain("That's the end of our reading practice.");
  });
});
