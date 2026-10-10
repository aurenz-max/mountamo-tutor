import { describe, expect, it } from 'vitest';
import { practiceScore } from './usePhaseResults';

describe('practiceScore', () => {
  it('is the mean of the rows the summary screen shows, not the re-graded record', () => {
    // The 10-10 screen: four items solved first try in the flow; the re-grade recorded one as wrong (75%).
    const summary = { outcomes: [100, 100, 100, 100].map(score => ({ score })) };
    expect(practiceScore(summary)).toBe(100);
  });

  it('rounds a mixed summary', () => {
    expect(practiceScore({ outcomes: [{ score: 100 }, { score: 67 }, { score: 0 }] })).toBe(56);
  });

  it('is undefined off the workspace path, so the caller keeps its own score', () => {
    expect(practiceScore(null)).toBeUndefined();
    expect(practiceScore(undefined)).toBeUndefined();
    expect(practiceScore({ outcomes: [] })).toBeUndefined();
  });
});
