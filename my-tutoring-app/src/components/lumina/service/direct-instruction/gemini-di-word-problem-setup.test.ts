import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: mocks.generateContent } } }));

import { generateDiWordProblemSetup } from './gemini-di-word-problem-setup';

const wrapper = {
  title: 'Story Builders',
  description: 'Listen, build the family, and solve each story.',
  themes: [
    { nameA: 'Leo', nameB: 'Mia', nounPlural: 'marbles', gainPast: 'found', gainBase: 'find', losePast: 'lost', loseBase: 'lose' },
    { nameA: 'Ava', nameB: 'Sam', nounPlural: 'stickers', gainPast: 'earned', gainBase: 'earn', losePast: 'gave away', loseBase: 'give away' },
    { nameA: 'Noah', nameB: 'Zoe', nounPlural: 'shells', gainPast: 'picked', gainBase: 'pick', losePast: 'dropped', loseBase: 'drop' },
    { nameA: 'Ivy', nameB: 'Ben', nounPlural: 'apples', gainPast: 'bought', gainBase: 'buy', losePast: 'ate', loseBase: 'eat' },
  ],
};

describe('generateDiWordProblemSetup eval-mode routing', () => {
  beforeEach(() => {
    mocks.generateContent.mockReset().mockResolvedValue({ text: JSON.stringify(wrapper) });
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
  });

  afterEach(() => vi.restoreAllMocks());

  it('pins one mode and applies that mode\'s support tier', async () => {
    const data = await generateDiWordProblemSetup('number families', 'second grade', {
      targetEvalMode: 'build_family', challengeCount: 3, difficulty: 'hard',
    });
    expect(data.problems).toHaveLength(3);
    expect(data.problems.every((problem) => problem.challengeType === 'build_family')).toBe(true);
    expect(data.problems.every((problem) => problem.supportTier === 'hard')).toBe(true);
  });

  it('interleaves exactly the identities in a curated blend and leaves it untiered', async () => {
    const data = await generateDiWordProblemSetup('set up and solve', 'second grade', {
      targetEvalMode: 'find_big_number|build_family', challengeCount: 4, difficulty: 'medium',
    });
    expect(new Set(data.problems.map((problem) => problem.challengeType))).toEqual(
      new Set(['find_big_number', 'build_family']),
    );
    expect(data.problems.every((problem) => problem.supportTier === undefined)).toBe(true);
  });

  it('covers every identity in a mixed run and expands the count when needed', async () => {
    const data = await generateDiWordProblemSetup('word problems', 'third grade', {
      targetEvalMode: 'mixed', challengeCount: 2, difficulty: 'easy',
    });
    expect(data.problems).toHaveLength(3);
    expect(new Set(data.problems.map((problem) => problem.challengeType))).toEqual(
      new Set(['find_big_number', 'build_family', 'classify_and_build']),
    );
    expect(data.problems.every((problem) => problem.supportTier === undefined)).toBe(true);
  });
});
