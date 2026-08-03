/**
 * L4 structural difficulty for di-sentence-reading: the tier's SECOND dial —
 * sentence LENGTH as a word-count band inside the session ceiling
 * (resolveProblemShape → rankByBand). These tests pin the whole contract:
 * the band's shape math (exhaustively, every ceiling × tier), enforcement at
 * selection time per eval mode, the two guardrails (benched 8-word ceiling is
 * never exceeded, a narrowed ceiling saturates the ladder honestly), pool
 * identity surviving the band, and non-vacuity (the no-tier path really does
 * differ from the hard path).
 *
 * The Gemini wrapper call is mocked to fail, so every run exercises the
 * deterministic code path — which is the authoritative one: Fork A code owns
 * selection; the prompt line is advisory.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn().mockRejectedValue(new Error('offline')) } },
}));

import {
  generateDiSentenceReading,
  resolveProblemShape,
} from './gemini-di-sentence-reading';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
  type DiSentenceReadingSupportTier,
} from '../../primitives/visual-primitives/direct-instruction/diSentenceReadingScript';

const TIERS: DiSentenceReadingSupportTier[] = ['easy', 'medium', 'hard'];

/** Neutral topic/intent: no vowel scope, no sight scope, no ceiling-narrowing
 *  phrases ("short sentence" / "simple sentence" would drop the ceiling to 5). */
const gen = (opts: {
  mode: string;
  difficulty?: string;
  grade?: string;
  intent?: string;
}) =>
  generateDiSentenceReading('sentence reading practice', opts.grade ?? 'first grade', {
    intent: opts.intent ?? 'sentence reading practice',
    targetEvalMode: opts.mode,
    ...(opts.difficulty !== undefined ? { difficulty: opts.difficulty } : {}),
  });

const wordCounts = (data: Awaited<ReturnType<typeof generateDiSentenceReading>>) =>
  data.challenges.map((c) => c.wordCount);

describe('resolveProblemShape — band math, exhaustive over every ceiling × tier', () => {
  it('band stays inside [floor, min(ceiling, benched max)] for ceilings 3..8', () => {
    for (let ceiling = 3; ceiling <= 8; ceiling++) {
      for (const tier of TIERS) {
        const { band } = resolveProblemShape('read_sentence', tier, ceiling);
        expect(band[0]).toBeLessThanOrEqual(band[1]);
        expect(band[0]).toBeGreaterThanOrEqual(MIN_SENTENCE_WORDS);
        expect(band[1]).toBeLessThanOrEqual(Math.min(ceiling, MAX_SENTENCE_WORDS));
      }
    }
  });

  it('easy anchors the floor, hard anchors the ceiling, tiers are monotonic', () => {
    for (let ceiling = 3; ceiling <= 8; ceiling++) {
      const [easy, medium, hard] = TIERS.map(
        (t) => resolveProblemShape('read_sentence', t, ceiling).band,
      );
      expect(easy[0]).toBe(MIN_SENTENCE_WORDS);
      expect(hard[1]).toBe(Math.max(MIN_SENTENCE_WORDS, Math.min(ceiling, MAX_SENTENCE_WORDS)));
      expect(easy[0]).toBeLessThanOrEqual(medium[0]);
      expect(medium[0]).toBeLessThanOrEqual(hard[0]);
      expect(easy[1]).toBeLessThanOrEqual(medium[1]);
      expect(medium[1]).toBeLessThanOrEqual(hard[1]);
    }
  });

  it('the full G1 ladder: easy [3,4] / medium [5,6] / hard [7,8]', () => {
    expect(resolveProblemShape('read_sentence', 'easy', 8).band).toEqual([3, 4]);
    expect(resolveProblemShape('read_sentence', 'medium', 8).band).toEqual([5, 6]);
    expect(resolveProblemShape('read_sentence', 'hard', 8).band).toEqual([7, 8]);
  });

  it('a ceiling ABOVE the benched maximum clamps to 8 — the benched limit is not a knob', () => {
    expect(resolveProblemShape('read_sentence', 'hard', 12).band).toEqual([7, 8]);
  });

  it('a degenerate ceiling collapses every tier to the floor, never below it', () => {
    for (const tier of TIERS) {
      expect(resolveProblemShape('read_sentence', tier, 2).band).toEqual([3, 3]);
    }
  });
});

describe('tier sweep @ G1 (ceiling 8), pinned read_sentence', () => {
  it('hard draws only 7-8 word sentences', async () => {
    const data = await gen({ mode: 'read_sentence', difficulty: 'hard' });
    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
    for (const wc of wordCounts(data)) expect(wc).toBeGreaterThanOrEqual(7);
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(8);
    expect(data.challenges.every((c) => c.supportTier === 'hard')).toBe(true);
  });

  it('medium draws only 5-6 word sentences', async () => {
    const data = await gen({ mode: 'read_sentence', difficulty: 'medium' });
    for (const wc of wordCounts(data)) expect(wc).toBeGreaterThanOrEqual(5);
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(6);
  });

  it('easy draws only 3-4 word sentences', async () => {
    const data = await gen({ mode: 'read_sentence', difficulty: 'easy' });
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(4);
    for (const wc of wordCounts(data)) expect(wc).toBeGreaterThanOrEqual(3);
  });

  it('NON-VACUITY: the no-tier path is the L0 shape — varied lengths, no tier stamp', async () => {
    const plain = await gen({ mode: 'read_sentence' });
    expect(plain.challenges.every((c) => c.supportTier === undefined)).toBe(true);
    // The untiered generic draw rotates across vowel families and so reaches
    // the short benched entries — proof the hard band above actually re-ranked
    // rather than the menu simply having nothing short.
    expect(wordCounts(plain).some((wc) => wc <= 4)).toBe(true);
  });
});

describe('honest saturation — a narrowed ceiling caps the ladder, never inflates past it', () => {
  it('kindergarten (ceiling 6): hard saturates to [5,6], nothing above 6 ships', async () => {
    const data = await gen({ mode: 'read_sentence', difficulty: 'hard', grade: 'kindergarten' });
    for (const wc of wordCounts(data)) expect(wc).toBeGreaterThanOrEqual(5);
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(6);
  });

  it('an explicit "short sentences" objective (ceiling 5): hard saturates to [4,5]', async () => {
    const data = await gen({
      mode: 'read_sentence',
      difficulty: 'hard',
      intent: 'reading short sentences',
    });
    for (const wc of wordCounts(data)) expect(wc).toBeGreaterThanOrEqual(4);
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(5);
  });
});

describe('pool identity survives the band — the tier never overrides an eval mode', () => {
  it('sight_phrase_sentence @ hard stays sight-heavy and saturates at its pool long end', async () => {
    const data = await gen({ mode: 'sight_phrase_sentence', difficulty: 'hard' });
    expect(data.challenges.every((c) => c.challengeType === 'sight_phrase_sentence')).toBe(true);
    // The sight pool holds three 7-8w entries; the fourth slot takes the
    // nearest below (6w) — honest saturation, never an out-of-pool grab.
    for (const wc of wordCounts(data)) expect(wc).toBeGreaterThanOrEqual(6);
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(8);
  });

  it('decodable_sentence @ hard fills the whole band from fully decodable entries', async () => {
    const data = await gen({ mode: 'decodable_sentence', difficulty: 'hard' });
    expect(data.challenges.every((c) => c.challengeType === 'decodable_sentence')).toBe(true);
    for (const wc of wordCounts(data)) expect(wc).toBeGreaterThanOrEqual(7);
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(8);
    // At least one of the L4 menu additions is drawn — proof the new entries
    // passed module-load validation (a miscounted or sentinel-unsafe entry is
    // silently rejected there, and this test would fail on band coverage).
    expect(
      data.challenges.some((c) =>
        /sam-cat-mat|ten-red-bed|big-pig-pit|hot-dog-log|pup-sun-run/.test(c.id),
      ),
    ).toBe(true);
  });

  it('a pinned vowel scope beats the band: short-a @ hard stays pure-a and saturates', async () => {
    const data = await gen({
      mode: 'read_sentence',
      difficulty: 'hard',
      intent: 'reading short a sentences',
    });
    // Scope holds on every item…
    expect(data.challenges.every((c) => c.vowels?.includes('a'))).toBe(true);
    // …the band reaches the one 8-word pure-a entry…
    expect(wordCounts(data).some((wc) => wc >= 7)).toBe(true);
    // …and the rest saturate downward inside the pool, never past the ceiling.
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(8);
  });

  it('sentence_review @ hard keeps its lesson-thread anchors from the focus pool', async () => {
    const data = await gen({
      mode: 'sentence_review',
      difficulty: 'hard',
      intent: 'reading short a sentences',
    });
    expect(data.challenges.every((c) => c.challengeType === 'sentence_review')).toBe(true);
    // Anchors are "up to 2" (the variance rotation may displace the second —
    // pre-L4 behavior, unchanged), but the FIRST anchor always ships, and
    // under a hard band seedForType draws it nearest-band from the focus pool:
    // deterministically the one 8-word pure-a entry.
    expect(data.challenges.some((c) => c.id.includes('sam-cat-mat'))).toBe(true);
    expect(data.challenges.filter((c) => c.vowels?.includes('a')).length).toBeGreaterThanOrEqual(1);
  });
});

describe('mixed sessions tier structurally too (SP-21 — no silent single-mode no-op)', () => {
  it('mixed + medium: all four identities present, every item tiered AND in band', async () => {
    const data = await gen({ mode: 'mixed', difficulty: 'medium' });
    const types = new Set(data.challenges.map((c) => c.challengeType));
    expect(types).toEqual(
      new Set(['decodable_sentence', 'read_sentence', 'sentence_review', 'sight_phrase_sentence']),
    );
    expect(data.challenges.every((c) => c.supportTier === 'medium')).toBe(true);
    for (const wc of wordCounts(data)) expect(wc).toBeGreaterThanOrEqual(5);
    for (const wc of wordCounts(data)) expect(wc).toBeLessThanOrEqual(6);
  });
});

describe('stress — floor and ceiling hold across every mode × tier × band', () => {
  it('no run ever ships a sentence outside [3, session ceiling]', async () => {
    const MODES = ['decodable_sentence', 'read_sentence', 'sentence_review', 'sight_phrase_sentence'];
    const GRADES: Array<[string, number]> = [
      ['kindergarten', 6],
      ['first grade', 8],
      ['second grade', 8],
    ];
    for (const mode of MODES) {
      for (const tier of TIERS) {
        for (const [grade, ceiling] of GRADES) {
          const data = await gen({ mode, difficulty: tier, grade });
          expect(data.challenges.length).toBeGreaterThanOrEqual(3);
          for (const c of data.challenges) {
            expect(c.wordCount).toBeGreaterThanOrEqual(MIN_SENTENCE_WORDS);
            expect(c.wordCount).toBeLessThanOrEqual(ceiling);
            expect(c.supportTier).toBe(tier);
          }
        }
      }
    }
  });
});
