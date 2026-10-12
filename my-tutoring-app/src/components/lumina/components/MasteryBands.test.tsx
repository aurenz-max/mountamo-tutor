// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MasteryBands, { bandIndex } from './MasteryBands';

describe('MasteryBands', () => {
  it('maps probabilities onto the five bands at their edges', () => {
    expect([0, 0.29, 0.3, 0.49, 0.5, 0.74, 0.75, 0.89, 0.9, 1].map(bandIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('names the jump when the band changed', () => {
    render(<MasteryBands p={0.87} before={0.63} />);
    expect(screen.getByLabelText('Nearly there, up from Getting there')).toBeTruthy();
  });

  it('reads as a single band without a before value', () => {
    render(<MasteryBands p={0.95} />);
    expect(screen.getByText('Got it')).toBeTruthy();
  });
});
