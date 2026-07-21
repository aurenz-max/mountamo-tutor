// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for counting-board item 13 (K subitize
 * flash-then-hide DISPLAY fork):
 *  1. K `subitize` flashes the objects briefly, then HIDES them before the numeric
 *     stepper answer surface is enabled. The hidden objects cannot be tapped/counted.
 *  2. K `count_all` is unchanged: objects stay visible, are tappable, and the answer
 *     is the counted set checked via Check Answer.
 *  3. Grade-1 `subitize` is unchanged: objects stay visible and the stepper is live
 *     immediately (no flash gating on reader grades).
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

import CountingBoard, { type CountingBoardChallenge, type CountingBoardData } from '../CountingBoard';

const challenge = (
  id: string,
  type: CountingBoardChallenge['type'],
  count: number,
  extra: Partial<CountingBoardChallenge> = {},
): CountingBoardChallenge => ({
  id,
  type,
  instruction: 'How many do you see?',
  targetAnswer: count,
  count,
  arrangement: 'line',
  hint: 'Look carefully.',
  narration: 'Count the objects.',
  ...extra,
});

const data = (
  gradeBand: CountingBoardData['gradeBand'],
  challenges: CountingBoardChallenge[],
): CountingBoardData => ({
  title: 'Counting-board reader-fit test',
  objects: { type: 'stars' },
  challenges,
  gradeBand,
});

// Object groups are the ONLY <g class="cursor-pointer"> in the workspace.
const objects = () => document.querySelectorAll('g.cursor-pointer');
// A counted object stamps a yellow count-badge circle (#eab308); its absence proves
// a tap never registered a count.
const countBadges = () => document.querySelectorAll('circle[fill="#eab308"]');

beforeEach(() => cleanup());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CountingBoard reader-fit item 13', () => {
  it('K subitize: objects flash then hide before the stepper; hidden objects are not tappable', async () => {
    vi.useFakeTimers();
    render(<CountingBoard data={data('K', [
      challenge('s1', 'subitize', 4),
      challenge('s2', 'subitize', 3),
    ])} />);

    // Pre-flash: objects hidden, no stepper, Check disabled.
    expect(objects()).toHaveLength(0);
    expect(screen.queryByText(/how many .* do you see/i)).toBeNull();
    expect((screen.getByRole('button', { name: /check answer/i }) as HTMLButtonElement).disabled).toBe(true);

    // Prep beat elapses → the objects flash into view.
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(objects()).toHaveLength(4);
    // Still no answer surface while flashing.
    expect(screen.queryByText(/how many .* do you see/i)).toBeNull();

    // Tapping during the flash must NOT count (subitizing is not tap-counting).
    fireEvent.click(objects()[0]);
    expect(countBadges()).toHaveLength(0);

    // Flash ends → objects hide, the numeric stepper becomes the answer surface.
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(objects()).toHaveLength(0);
    expect(screen.getByText(/how many .* do you see/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /check answer/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('K count_all is unchanged: objects stay visible and tapping counts them', () => {
    render(<CountingBoard data={data('K', [
      challenge('c1', 'count_all', 3),
      challenge('c2', 'count_all', 4),
    ])} />);

    // Objects are visible immediately (no flash gate) and tappable.
    expect(objects()).toHaveLength(3);
    expect(screen.getByText(/counted:/i)).toBeTruthy();

    fireEvent.click(objects()[0]);
    fireEvent.click(objects()[1]);
    fireEvent.click(objects()[2]);
    // Three taps registered three counted objects.
    expect(countBadges()).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));
    expect(screen.getByText(/next challenge/i)).toBeTruthy();
  });

  it('Grade-1 subitize is unchanged: objects stay visible and the stepper is live immediately', () => {
    render(<CountingBoard data={data('1', [
      challenge('g1', 'subitize', 5),
      challenge('g2', 'subitize', 4),
    ])} />);

    // No flash gating on reader grades: objects present and stepper shown at once.
    expect(objects()).toHaveLength(5);
    expect(screen.getByText(/how many .* do you see/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /check answer/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
