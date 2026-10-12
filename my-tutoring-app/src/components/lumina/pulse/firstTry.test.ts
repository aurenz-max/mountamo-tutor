import { describe, expect, it } from 'vitest';
import { firstTryResults } from './firstTry';

describe('firstTryResults', () => {
  it('reads the per-challenge results array from studentWork', () => {
    const r = firstTryResults({
      studentWork: { challengeResults: [{ attempts: 1, correct: true }, { attempts: 3, correct: true }, { attempts: 1, correct: false }] },
      metrics: { type: 'x' } as never,
    });
    expect(r).toEqual([true, false, false]);
  });

  it('falls back to metrics and ignores arrays without numeric attempts', () => {
    const r = firstTryResults({
      studentWork: { picks: [{ id: 'a' }] },
      metrics: { type: 'x', results: [{ attempts: 1 }, { attempts: 2 }] } as never,
    });
    expect(r).toEqual([true, false]);
  });

  it('returns undefined when no primitive reports challenges', () => {
    expect(firstTryResults({ studentWork: undefined, metrics: { type: 'x' } as never })).toBeUndefined();
  });
});
