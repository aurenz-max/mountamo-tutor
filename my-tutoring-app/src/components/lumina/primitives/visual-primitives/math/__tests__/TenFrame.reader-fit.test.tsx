// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for ten-frame item 12:
 *  1. K make-ten is enacted by tapping empty frame cells. Seed counters are
 *     fixed, the placed complement auto-judges on a full frame, and there is no
 *     proxy stepper or Check button.
 *  2. K build/count-all and subitize keep their existing response protocols.
 *  3. Grade 1-2 make-ten keeps its numeric stepper + Check protocol.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import TenFrame, { type TenFrameChallenge, type TenFrameData } from '../TenFrame';

const challenge = (
  id: string,
  type: TenFrameChallenge['type'],
  targetCount: number,
  extra: Partial<TenFrameChallenge> = {},
): TenFrameChallenge => ({
  id,
  type,
  targetCount,
  instruction: type === 'make_ten'
    ? `There are ${targetCount} counters on the frame. How many more do you need to make 10?`
    : 'Use the ten frame.',
  hint: 'Look at the frame.',
  narration: 'Use the frame.',
  ...extra,
});

const data = (
  gradeBand: TenFrameData['gradeBand'],
  challenges: TenFrameChallenge[],
): TenFrameData => ({
  title: 'Ten-frame reader-fit test',
  mode: 'single',
  counters: { count: 0, color: 'red', positions: [] },
  challenges,
  showOptions: { showCount: false, showEmptyCount: false, showEquation: false },
  gradeBand,
});

const cells = () => Array.from(document.querySelectorAll<SVGRectElement>('rect.cursor-pointer'));
const counters = () => document.querySelectorAll('svg circle');

beforeEach(() => cleanup());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TenFrame reader-fit item 12', () => {
  it('K make-ten: empty-cell taps enact the complement and auto-complete; seed counters are fixed', async () => {
    render(<TenFrame data={data('K', [
      challenge('m1', 'make_ten', 6),
      challenge('m2', 'make_ten', 7),
    ])} />);

    expect(counters()).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /check answer/i })).toBeNull();
    expect(screen.queryByText(/6 \+ ___ = 10/)).toBeNull();

    // The six seeded counters are not removable in this K-only branch.
    fireEvent.click(cells()[0]);
    expect(counters()).toHaveLength(6);

    // Three placed counters are not enough; the fourth is the enacted answer.
    fireEvent.click(cells()[6]);
    fireEvent.click(cells()[7]);
    fireEvent.click(cells()[8]);
    expect(counters()).toHaveLength(9);
    expect(screen.queryByText(/next challenge/i)).toBeNull();

    fireEvent.click(cells()[9]);
    expect(await screen.findByText(/next challenge/i)).toBeTruthy();
    expect(screen.getByText(/6 \+ 4 = 10/)).toBeTruthy();

    // Advancing seeds the next make-ten challenge and retains the K protocol.
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(counters()).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /check answer/i })).toBeNull();
  });

  it('K build/count-all is unchanged: frame construction still uses Check Answer', () => {
    render(<TenFrame data={data('K', [
      challenge('b1', 'build', 2),
      challenge('b2', 'build', 3),
    ])} />);

    expect(screen.getByRole('button', { name: /check answer/i })).toBeTruthy();
    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
    expect(screen.getByText(/next challenge/i)).toBeTruthy();
  });

  it('clears a completed make-ten frame before the next operate/add challenge', async () => {
    render(<TenFrame data={data('K', [
      challenge('m1', 'make_ten', 9),
      challenge('a1', 'add', 5, { addend1: 2, addend2: 3, instruction: 'Show 2 + 3 on the frame!' }),
    ])} />);

    expect(counters()).toHaveLength(9);
    fireEvent.click(cells()[9]);
    expect(await screen.findByText(/next challenge/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(screen.getByText(/show 2 \+ 3 on the frame/i)).toBeTruthy();
    expect(counters()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /check answer/i })).toBeTruthy();
  });

  it('K subitize is unchanged: counters hide before its numeric response is enabled', async () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [
      challenge('s1', 'subitize', 4, { flashDuration: 1500 }),
      challenge('s2', 'subitize', 3, { flashDuration: 1500 }),
    ])} />);

    const check = screen.getByRole('button', { name: /check answer/i }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /flash counters/i }));
    expect(counters()).toHaveLength(4);

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(counters()).toHaveLength(0);
    expect(screen.getByText(/how many counters did you see/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /check answer/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Grade 1-2 make-ten is unchanged: numeric stepper and Check Answer remain', async () => {
    const user = userEvent.setup();
    render(<TenFrame data={data('1-2', [
      challenge('g1', 'make_ten', 6),
      challenge('g2', 'make_ten', 5),
    ])} />);

    expect(screen.getByText(/6 \+ ___ = 10/)).toBeTruthy();
    const plus = screen.getByRole('button', { name: '+' });
    await user.click(plus);
    await user.click(plus);
    await user.click(plus);
    await user.click(plus);
    await user.click(screen.getByRole('button', { name: /check answer/i }));
    expect(await screen.findByText(/next challenge/i)).toBeTruthy();
  });
});
