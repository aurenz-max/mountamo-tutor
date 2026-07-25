/**
 * Contrastive correction — the 2026-07-25 user ruling, across both packs that
 * carry it (di-sentence-reading, di-math-facts).
 *
 * WHY THIS EXISTS. The first live correction run in any DI pack (HUMAN-CHECKS
 * #54) showed a reader repeat the SAME substitution three times against an
 * identical whole-sentence re-model: a re-model asks the learner to diff it
 * against their memory of what they just said, so it never teaches WHICH word
 * was wrong. The correction now names the error and contrasts it.
 *
 * The load-bearing invariant is that this bought no engine risk. Sentinel
 * classification matches OPENERS only (`matchesOpener`, judgedLoopModel.ts), so
 * a mid-line slot cannot reach it — these tests pin that, plus the byte-exact
 * survival of the bench-proven fallback line.
 */

import { describe, it, expect } from 'vitest';
import { scanForSentinel, DI_SENTINELS } from '../../../hooks/judgedLoopModel';
import {
  correctionLine as sentenceCorrection,
  contrastCorrectionLine as sentenceContrast,
  judgingContract as sentenceContract,
  type DiSentenceReadingChallenge,
} from './diSentenceReadingScript';
import {
  correctionLine as factCorrection,
  contrastCorrectionLine as factContrast,
  judgingContract as factContract,
  type DiMathFactsChallenge,
} from './diMathFactsScript';

const SENTENCE: DiSentenceReadingChallenge = {
  id: 'disr-mom-pot',
  challengeType: 'read_sentence',
  text: 'Mom got a pot.',
  wordCount: 4,
};

/** The live-run fact: "2 + 1", echoed back as "one". */
const FACT: DiMathFactsChallenge = {
  id: 'fact-2p1',
  challengeType: 'answer_fact',
  a: 2,
  b: 1,
  display: '2 + 1',
  problem: 'two plus one',
  answerWord: 'three',
  answerNumeral: 3,
  solvedDisplay: '2 + 1 = 3',
};

const SLOT = '⟨what they said⟩';

describe('contrastive correction — sentinel safety (the load-bearing claim)', () => {
  const cases = [
    ['di-sentence-reading', sentenceContrast(SENTENCE)],
    ['di-math-facts', factContrast(FACT)],
  ] as const;

  it.each(cases)('%s contrast line still classifies as a correction', (_pack, line) => {
    expect(scanForSentinel(line, DI_SENTINELS)).toBe('corrected');
  });

  it.each(cases)('%s contrast line keeps the "My turn" opener byte-exact', (_pack, line) => {
    expect(line.startsWith('My turn:')).toBe(true);
  });

  it.each(cases)('%s contrast line carries exactly one fillable slot', (_pack, line) => {
    expect(line).toContain(SLOT);
    expect(line.split('⟨')).toHaveLength(2);
  });

  it('a FILLED contrast line still classifies as a correction', () => {
    // What the tutor actually speaks once the slot is resolved from audio.
    const spokenSentence = sentenceContrast(SENTENCE).replace(SLOT, 'the pot');
    const spokenFact = factContrast(FACT).replace(SLOT, 'one');
    expect(spokenSentence).toBe('My turn: not the pot — Mom got a pot. Your turn. Read it again.');
    expect(spokenFact).toBe('My turn: not one — two plus one is three. Your turn. What is two plus one?');
    expect(scanForSentinel(spokenSentence, DI_SENTINELS)).toBe('corrected');
    expect(scanForSentinel(spokenFact, DI_SENTINELS)).toBe('corrected');
  });

  it('the contrast ends on the CORRECT form, then re-elicits (recency + gate 3)', () => {
    // The learner's last hearing before their retry must be the right one.
    expect(sentenceContrast(SENTENCE)).toContain('— Mom got a pot. Your turn.');
    expect(factContrast(FACT)).toContain('— two plus one is three. Your turn.');
  });
});

describe('the bench-proven fallback survives byte-for-byte', () => {
  it('di-sentence-reading plain re-model is unchanged', () => {
    expect(sentenceCorrection(SENTENCE)).toBe('My turn: Mom got a pot. Your turn. Read it again.');
  });

  it('di-math-facts plain re-model is unchanged', () => {
    expect(factCorrection(FACT)).toBe('My turn: two plus one is three. Your turn. What is two plus one?');
  });
});

describe('the judging contract routes both branches', () => {
  it.each([
    ['di-sentence-reading', sentenceContract(SENTENCE), sentenceContrast(SENTENCE), sentenceCorrection(SENTENCE)],
    ['di-math-facts', factContract(FACT), factContrast(FACT), factCorrection(FACT)],
  ] as const)('%s offers the contrast branch AND the nothing-to-contrast fallback', (_pack, contract, contrast, fallback) => {
    expect(contract).toContain(contrast);
    expect(contract).toContain(fallback);
    // The slot must be explained, or the tutor speaks the marks aloud.
    expect(contract).toContain('Never speak the ⟨ ⟩ marks');
  });

  it.each([
    ['di-sentence-reading', sentenceContract(SENTENCE)],
    ['di-math-facts', factContract(FACT)],
  ] as const)('%s forbids drifting to a third wording on a repeat miss', (_pack, contract) => {
    expect(contract).toMatch(/do not invent a third wording/i);
  });

  it('the math contract names the echo misconception the live run surfaced', () => {
    expect(factContract(FACT)).toMatch(/echoing a number straight out of the problem/i);
  });
});
