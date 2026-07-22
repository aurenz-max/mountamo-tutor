// @vitest-environment jsdom
/**
 * Behavioral test for the how-it-works PRE (K) picture-order render — reader-fit
 * 2026-07-21. At K the generator emits a `preReader` payload (emoji steps authored
 * in order) and the component drops the reading-heavy magazine + text quiz for a
 * picture-primary tap-to-order task: tap tray cards into the slots, it auto-checks
 * when full (no Check button), a correct order submits success + shows 🎉, a wrong
 * order does NOT submit and can be recovered by tapping a placed card back out.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn<(m: string, opts?: unknown) => void>();
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

const submitEvaluation = vi.fn();
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitEvaluation, hasSubmitted: false, submittedResult: null, elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(), tick: vi.fn(), select: vi.fn(), pop: vi.fn(),
    playCorrect: vi.fn(), playIncorrect: vi.fn(), playStreak: vi.fn(),
    isEnabled: () => false, getVolume: () => 1, play: vi.fn(),
  },
}));

import HowItWorks, { type HowItWorksData } from './HowItWorks';

// jsdom has no IntersectionObserver; the PRE path doesn't use it, but the
// component wires one for the magazine path — stub it so mount doesn't throw.
class NoopIO { observe() {} unobserve() {} disconnect() {} }
// @ts-expect-error test shim
global.IntersectionObserver = NoopIO;

const makeData = (): HowItWorksData => ({
  title: 'How a Tow Truck Works',
  subtitle: '',
  overview: 'Let us learn how a tow truck helps a car.',
  steps: [],
  summary: { text: 'x', keyTakeaway: 'x' },
  challenges: [],
  preReader: {
    question: 'Put the tow truck steps in order.',
    steps: [
      { id: 'p0', emoji: '🚗', label: 'Car stops', spoken: 'The car stops.' },
      { id: 'p1', emoji: '⛓️', label: 'Hook the car', spoken: 'The truck hooks the car.' },
      { id: 'p2', emoji: '🚚', label: 'Tow away', spoken: 'The truck tows the car away.' },
    ],
  },
});

const placeTray = (id: string) => {
  const btn = document.querySelector(`[data-step-id="${id}"]`) as HTMLButtonElement | null;
  expect(btn, `tray card ${id} should be present`).toBeTruthy();
  act(() => { fireEvent.click(btn!); });
};

beforeEach(() => { submitEvaluation.mockClear(); sendText.mockClear(); });
afterEach(() => cleanup());

describe('how-it-works PRE picture-order', () => {
  it('renders emoji cards and NO magazine chrome', () => {
    render(<HowItWorks data={makeData()} />);
    // Picture cards present (labels are captions)
    expect(screen.getByText('Car stops')).toBeTruthy();
    expect(screen.getByText('Tow away')).toBeTruthy();
    // The spoken prompt shows; adult chrome does not
    expect(screen.getByText('Put the tow truck steps in order.')).toBeTruthy();
    expect(screen.queryByText(/Comprehension Check/i)).toBeNull();
    expect(screen.queryByText(/Check Order/i)).toBeNull();
    expect(screen.queryByText(/Challenge \d/i)).toBeNull();
  });

  it('reads the steps aloud on connect (ORIENT/STIMULUS), unprompted', () => {
    render(<HowItWorks data={makeData()} />);
    const orient = sendText.mock.calls.find(c => String(c[0]).includes('[ACTIVITY_START_PRE]'));
    expect(orient, 'ORIENT beat should fire').toBeTruthy();
    // every step's spoken line is in the script
    expect(String(orient![0])).toContain('The car stops.');
    expect(String(orient![0])).toContain('The truck tows the car away.');
  });

  it('a correct order auto-submits success + celebrates (no Check button)', () => {
    render(<HowItWorks data={makeData()} />);
    placeTray('p0'); placeTray('p1'); placeTray('p2'); // authored = correct order
    expect(submitEvaluation).toHaveBeenCalledTimes(1);
    const [passed, score] = submitEvaluation.mock.calls[0];
    expect(passed).toBe(true);
    expect(score).toBe(100);
    expect(screen.getByText('🎉')).toBeTruthy();
  });

  it('a wrong order does NOT submit, and a placed card can be tapped back out (undo)', () => {
    render(<HowItWorks data={makeData()} />);
    placeTray('p2'); placeTray('p1'); placeTray('p0'); // reversed = wrong
    expect(submitEvaluation).not.toHaveBeenCalled();
    const wrong = sendText.mock.calls.find(c => String(c[0]).includes('[PRE_WRONG]'));
    expect(wrong, 'wrong-order hint should fire').toBeTruthy();
    // No answer leak: the hint must not spell out the full ordered list.
    expect(String(wrong![0])).not.toContain('The truck tows the car away.');
    // Tray is empty once all three are placed.
    expect(document.querySelector('[data-step-id="p0"]')).toBeNull();
    // Undo: tap the placed "Car stops" card → it returns to the tray.
    const placed = screen.getByText('Car stops').closest('button')!;
    act(() => { fireEvent.click(placed); });
    expect(document.querySelector('[data-step-id="p0"]'), 'card returns to tray after undo').toBeTruthy();
  });
});
