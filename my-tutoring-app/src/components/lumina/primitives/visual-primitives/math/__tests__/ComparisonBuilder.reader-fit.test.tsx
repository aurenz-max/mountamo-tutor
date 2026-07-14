// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for the K (PRE-band) compare-groups rebuild:
 * the two group PICTURES plus a middle "=" ARE the tappable answer surface
 * (tap=choose, picture-primary) — there are no "More/Fewer/The Same" text buttons
 * and no Check button. Tapping the side with more (or "=" for equal) atomically
 * answers; a wrong tap does not complete the challenge.
 *
 * These are the behaviors tsc can't verify. External hooks (live tutor, evaluation,
 * audio) are mocked so we drive pure component logic.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import ComparisonBuilder, { type ComparisonBuilderChallenge } from '../ComparisonBuilder';

const groups = (
  id: string,
  leftCount: number,
  rightCount: number,
  correctAnswer: 'more' | 'less' | 'equal',
): ComparisonBuilderChallenge => ({
  id,
  type: 'compare-groups',
  instruction: 'Which side has more?',
  leftGroup: { count: leftCount, objectType: 'bears' },
  rightGroup: { count: rightCount, objectType: 'bears' },
  correctAnswer,
});

const data = (challenges: ComparisonBuilderChallenge[]) => ({
  title: 'Reader-fit test',
  challenges,
  gradeBand: 'K' as const,
  showCorrespondenceLines: true,
  useAlligatorMnemonic: true,
});

// The compare-groups SVG has exactly two <rect> during solve (the group boxes,
// index 0 = left, 1 = right) and one <circle> (the middle "=") at K.
const groupRects = () => Array.from(document.querySelectorAll('svg rect'));
const sameCircle = () => document.querySelector('svg circle') as SVGCircleElement;

beforeEach(() => cleanup());

describe('ComparisonBuilder reader-fit (K band, compare-groups)', () => {
  it('K surface: no text answer buttons and no Check — pictures are the answer', () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 1, 'more'), groups('c2', 1, 1, 'equal')])} />);
    expect(screen.queryByRole('button', { name: /^more$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^fewer$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /the same/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^check/i })).toBeNull();
    // Two group boxes + the "=" affordance are present as the tappable surface.
    expect(groupRects().length).toBe(2);
    expect(sameCircle()).toBeTruthy();
  });

  it('tapping the LEFT group when left has more atomically completes the challenge', async () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 1, 'more'), groups('c2', 2, 2, 'equal')])} />);
    fireEvent.click(groupRects()[0]); // left box → "left has more"
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('tapping the RIGHT group when right has more (left = less) completes', async () => {
    render(<ComparisonBuilder data={data([groups('c1', 2, 4, 'less'), groups('c2', 2, 2, 'equal')])} />);
    fireEvent.click(groupRects()[1]); // right box → "right has more" = left less
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('tapping the middle "=" when the groups are equal completes', async () => {
    render(<ComparisonBuilder data={data([groups('c1', 3, 3, 'equal'), groups('c2', 1, 2, 'less')])} />);
    fireEvent.click(sameCircle());
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('a WRONG tap does not complete the challenge (still solvable, no Next yet)', () => {
    render(<ComparisonBuilder data={data([groups('c1', 1, 4, 'less'), groups('c2', 2, 2, 'equal')])} />);
    fireEvent.click(groupRects()[0]); // taps LEFT (asserts left more) but left has fewer
    expect(screen.queryByText(/next challenge/i)).toBeNull();
  });
});
