import { describe, expect, it } from 'vitest';
import { pickNearestBeta } from './resolvePulseEvalModes';

const MODES = [
  { evalMode: 'count', beta: 1.5 },
  { evalMode: 'subitize', beta: 3.0 },
  { evalMode: 'add_more', beta: 4.5 },
  { evalMode: 'take_away', beta: 6.0 },
];

describe('pickNearestBeta', () => {
  it('picks only among fitting modes, even when a non-fitting mode is nearer the target', () => {
    // take_away (6.0) is nearest to 5.8 but does not fit the subskill.
    expect(pickNearestBeta(MODES, ['count', 'subitize'], 5.8)).toEqual({ key: 'subitize', beta: 3.0 });
  });

  it('picks the nearest fitting mode', () => {
    expect(pickNearestBeta(MODES, ['count', 'subitize', 'add_more'], 4.0)).toEqual({ key: 'add_more', beta: 4.5 });
  });

  it('breaks ties toward the easier mode', () => {
    expect(pickNearestBeta(MODES, ['subitize', 'add_more'], 3.75)).toEqual({ key: 'subitize', beta: 3.0 });
  });

  it('returns null when nothing fits', () => {
    expect(pickNearestBeta(MODES, [], 3)).toBeNull();
    expect(pickNearestBeta(MODES, ['not_a_mode'], 3)).toBeNull();
  });
});

describe('betaToScaffoldingMode', () => {
  it('follows the backend THETA_TO_MODE thresholds', async () => {
    const { betaToScaffoldingMode } = await import('./practice-manifest');
    expect([1.5, 2.0, 2.5, 3.5, 4.5, 5.9, 6.5, 8].map(betaToScaffoldingMode)).toEqual([1, 2, 2, 3, 4, 4, 5, 6]);
  });
});
