import { describe, it, expect } from 'vitest';
import { isPlotPlacementCorrect } from './numberLineGrading';

// NL-2: plot_point used to accept one snap step off the target.
describe('isPlotPlacementCorrect', () => {
  it('rejects one tick off an on-grid target, for every number type', () => {
    expect(isPlotPlacementCorrect(7, 7, 1)).toBe(true);
    expect(isPlotPlacementCorrect(6, 7, 1)).toBe(false);
    expect(isPlotPlacementCorrect(8, 7, 1)).toBe(false);
    expect(isPlotPlacementCorrect(0.42, 0.43, 0.01)).toBe(false);
    expect(isPlotPlacementCorrect(0.43, 0.43, 0.01)).toBe(true);
    expect(isPlotPlacementCorrect(0.5, 0.625, 1 / 8)).toBe(false);
  });

  it('keeps an off-grid target reachable at its nearest grid point', () => {
    expect(isPlotPlacementCorrect(0.375, 1 / 3, 1 / 8)).toBe(true);
    expect(isPlotPlacementCorrect(0.25, 1 / 3, 1 / 8)).toBe(false);
    // Exactly halfway: both nearest points are accepted, so the target is reachable.
    expect(isPlotPlacementCorrect(0, 1 / 16, 1 / 8)).toBe(true);
    expect(isPlotPlacementCorrect(0.125, 1 / 16, 1 / 8)).toBe(true);
  });
});
