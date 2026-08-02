/**
 * L3 support tiers for di-math-facts. The whole ladder is
 * instruction-as-scaffold (modality #2): a tier withdraws DISTAR sub-steps from
 * the SPOKEN cue and changes nothing else. These tests pin both halves of that
 * claim — what withdraws, and what must NOT.
 *
 * The strongest assertion is stronger than the sentence pack's: at `hard` the
 * ANSWER WORD must be absent from everything the tutor may say pre-attempt,
 * and unlike the printed sentence the answer exists nowhere on screen either
 * (answer-leak rule) — so `hard` is a genuine retrieval probe, not just a
 * closed echo route.
 */

import { describe, it, expect } from 'vitest';
import {
  itemCue,
  moveOnCue,
  correctionLine,
  contrastCorrectionLine,
  verifyLine,
  testLine,
  type DiMathFactsChallenge,
  type DiMathFactsSupportTier,
} from './diMathFactsScript';

/** 2 + 1 = 3 — the answer word "three" appears nowhere in the problem text,
 *  so a `toContain('three')` hit can only come from a leaked answer. */
const fact = (
  supportTier?: DiMathFactsSupportTier,
  overrides: Partial<DiMathFactsChallenge> = {},
): DiMathFactsChallenge => ({
  id: 'dimf-1-2p1',
  challengeType: 'answer_fact',
  a: 2,
  b: 1,
  display: '2 + 1',
  problem: 'two plus one',
  answerWord: 'three',
  answerNumeral: 3,
  solvedDisplay: '2 + 1 = 3',
  ...(supportTier ? { supportTier } : {}),
  ...overrides,
});

/** 3 - 1 = 2 for the move-on target (answer "two" absent from its problem). */
const nextFact = (supportTier?: DiMathFactsSupportTier): DiMathFactsChallenge => ({
  id: 'dimf-2-3m1',
  challengeType: 'subtraction_fact',
  a: 3,
  b: 1,
  display: '3 - 1',
  problem: 'three minus one',
  answerWord: 'two',
  answerNumeral: 2,
  solvedDisplay: '3 - 1 = 2',
  ...(supportTier ? { supportTier } : {}),
});

/** The block the tutor is told to "Speak exactly" — everything it may say. */
const spokenBlock = (cue: string): string => {
  const m = cue.match(/Speak exactly:\n"([\s\S]*?)"/);
  if (!m) throw new Error(`no spoken block in cue:\n${cue}`);
  return m[1];
};

describe('di-math-facts support tiers — the DISTAR ladder', () => {
  it('easy hands over the FULL sequence: model + guide + test', () => {
    const spoken = spokenBlock(itemCue(fact('easy')));
    expect(spoken).toContain('Listen: two plus one is three.');
    expect(spoken).toContain('Together: two plus one is three.');
    expect(spoken).toContain('Your turn. What is two plus one?');
  });

  it('medium withdraws the choral guide but keeps the model', () => {
    const spoken = spokenBlock(itemCue(fact('medium')));
    expect(spoken).toContain('Listen: two plus one is three.');
    expect(spoken).not.toContain('Together:');
    expect(spoken).toContain('Your turn. What is two plus one?');
  });

  it('hard is a COLD answer — the tutor is given nothing to say but the ask', () => {
    const spoken = spokenBlock(itemCue(fact('hard')));
    expect(spoken).not.toContain('Listen:');
    expect(spoken).not.toContain('Together:');
    expect(spoken.trim()).toBe('Your turn. What is two plus one?');
  });

  it('hard NEVER puts the ANSWER in the spoken block (the point of the tier)', () => {
    // Stronger than the sentence pack's twin: the printed sentence is at least
    // on screen at `hard`, but this answer exists NOWHERE pre-attempt — not on
    // the stage (answer-leak rule) and not in the tutor's mouth. The judging
    // contract still carries it, because judging never changes with tier.
    const cue = itemCue(fact('hard'));
    expect(spokenBlock(cue)).not.toContain('three');
    expect(cue).toContain('three'); // still judged against it
    expect(cue).toContain('answering this one cold on purpose');
  });

  it('an absent tier behaves exactly as easy (pre-L3 sessions are unchanged)', () => {
    expect(spokenBlock(itemCue(fact(undefined)))).toBe(
      spokenBlock(itemCue(fact('easy'))),
    );
  });

  it('the opening cue carries the tier too', () => {
    const spoken = spokenBlock(itemCue(fact('hard'), true));
    expect(spoken.trim()).toBe('Your turn. What is two plus one?');
    expect(itemCue(fact('hard'), true)).toContain('brisk math-facts practice');
  });

  it('the ladder reads identically through every task identity', () => {
    // One cue shape, four skills: the tier composes through the same lead-in
    // for counting and subtraction items, and the cold block never carries
    // their answers either.
    const counting = fact('hard', {
      id: 'dimf-3-n5',
      challengeType: 'counting_next',
      a: 5,
      b: 1,
      display: '5 →',
      problem: 'the number after five',
      answerWord: 'six',
      answerNumeral: 6,
      solvedDisplay: '5 → 6',
    });
    const subtraction = nextFact('hard');
    for (const item of [counting, subtraction]) {
      const spoken = spokenBlock(itemCue(item));
      expect(spoken.trim()).toBe(testLine(item));
      expect(spoken).not.toContain(item.answerWord);
    }
  });
});

describe('di-math-facts support tiers — what must NOT change', () => {
  const tiers: DiMathFactsSupportTier[] = ['easy', 'medium', 'hard'];

  it('the CORRECTION re-models the whole fact at every tier (standing gate 3)', () => {
    // Remediation is not scaffolding: DISTAR always re-models on an error, so a
    // hard tier withholds the up-front model and still re-states on a miss.
    for (const tier of tiers) {
      const plain = correctionLine(fact(tier));
      expect(plain).toBe('My turn: two plus one is three. Your turn. What is two plus one?');
      const contrast = contrastCorrectionLine(fact(tier));
      expect(contrast).toContain('two plus one is three');
    }
  });

  it('the restating AFFIRM is identical at every tier', () => {
    for (const tier of tiers) {
      expect(verifyLine(fact(tier))).toBe('Yes, two plus one is three.');
    }
  });

  it('the judging contract is byte-identical across tiers', () => {
    // A tier changes how much help precedes the answer — never how the answer
    // is judged. If this drifts, the tiers stop being comparable evidence.
    const contractOf = (tier: DiMathFactsSupportTier) =>
      itemCue(fact(tier)).split('Then wait for the learner.')[1];
    expect(contractOf('medium')).toBe(contractOf('easy'));
    expect(contractOf('hard')).toBe(contractOf('easy'));
  });

  it('the fact itself is untouched by tier — support moves, content does not', () => {
    for (const tier of tiers) {
      const ch = fact(tier);
      expect(ch.display).toBe('2 + 1');
      expect(ch.answerWord).toBe('three');
      expect(ch.answerNumeral).toBe(3);
    }
  });
});

describe('di-math-facts support tiers — move-on cue', () => {
  it("composes the NEXT item at the NEXT item's tier", () => {
    const spoken = spokenBlock(moveOnCue(fact('easy'), nextFact('hard')));
    expect(spoken).toContain('Good try.');
    expect(spoken).not.toContain('Listen:');
    expect(spoken).not.toContain('two'); // the next fact's answer stays unsaid
    expect(spoken).toContain('Your turn. What is three minus one?');
  });

  it('still models the next item at easy', () => {
    const spoken = spokenBlock(moveOnCue(fact('hard'), nextFact('easy')));
    expect(spoken).toContain('Listen: three minus one is two.');
    expect(spoken).toContain('Together: three minus one is two.');
  });

  it('the final move-on (no next item) closes the session at any tier', () => {
    expect(moveOnCue(fact('hard'))).toContain("That's the end of our math practice.");
  });
});
