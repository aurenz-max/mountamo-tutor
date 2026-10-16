// @vitest-environment jsdom
/**
 * Behavioral test for the how-it-works PRE (K) picture path — reader-fit 2026-07-21, re-based 2026-10-16 (W1 rebuild).
 * At K the generator emits a `preReader` payload (emoji steps authored in order) and the component drops the
 * reading-heavy magazine for picture cards: the story first (the pictures in order, read aloud by the tutor), then a
 * big play button, then the picture question (here the default, the picture order): tap tray cards into the slots, it
 * auto-checks when full (no Check button), a correct order celebrates and, after See Results, submits success; a wrong
 * order does NOT submit, its hint names no order, and a placed card can be tapped back out.
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

const makeData = (): HowItWorksData => ({
  title: 'How a Tow Truck Works',
  subtitle: '',
  overview: 'Let us learn how a tow truck helps a car.',
  steps: [],
  summary: { text: 'x', keyTakeaway: 'x' },
  preReader: {
    question: 'Put the tow truck steps in order.',
    steps: [
      { id: 'p0', emoji: '🚗', label: 'Car stops', spoken: 'The car stops.' },
      { id: 'p1', emoji: '⛓️', label: 'Hook the car', spoken: 'The truck hooks the car.' },
      { id: 'p2', emoji: '🚚', label: 'Tow away', spoken: 'The truck tows the car away.' },
    ],
  },
});

const start = () => act(() => { fireEvent.click(screen.getByLabelText('Start the questions')); });
const placeTray = (id: string) => {
  const btn = document.querySelector(`[data-step-id="${id}"]`) as HTMLButtonElement | null;
  expect(btn, `tray card ${id} should be present`).toBeTruthy();
  act(() => { fireEvent.click(btn!); });
};

beforeEach(() => { submitEvaluation.mockClear(); sendText.mockClear(); });
afterEach(() => cleanup());

describe('how-it-works PRE picture path', () => {
  it('shows the picture story, then the picture question, with NO magazine chrome', () => {
    render(<HowItWorks data={makeData()} />);
    expect(screen.getByText('Car stops')).toBeTruthy();
    expect(screen.getByText('Tow away')).toBeTruthy();
    expect(screen.queryByText(/Steps explored|Glossary|Quick Facts/i)).toBeNull();
    start();
    expect(screen.getByText('Put the tow truck steps in order.')).toBeTruthy();
    expect(screen.queryByText(/Check Answer|Check Order/i)).toBeNull();
    expect(document.querySelectorAll('[data-step-id]').length).toBe(3);
  });

  it('reads the story aloud on connect (ORIENT/STIMULUS), unprompted, and the question when it opens', () => {
    render(<HowItWorks data={makeData()} />);
    const orient = sendText.mock.calls.find(c => String(c[0]).includes('[ACTIVITY_START_PRE]'));
    expect(orient, 'ORIENT beat should fire').toBeTruthy();
    expect(String(orient![0])).toContain('The car stops.');
    expect(String(orient![0])).toContain('The truck tows the car away.');
    start();
    const ask = sendText.mock.calls.find(c => String(c[0]).includes('[READ_QUESTION]'));
    expect(String(ask![0])).toContain('Put the tow truck steps in order.');
  });

  it('a correct order auto-checks and celebrates (no Check button), and submits success once the child moves on', () => {
    render(<HowItWorks data={makeData()} />);
    start();
    placeTray('p0'); placeTray('p1'); placeTray('p2'); // authored = correct order
    expect(screen.getByText('🎉')).toBeTruthy();
    act(() => { fireEvent.click(screen.getByText('See Results')); });
    expect(submitEvaluation).toHaveBeenCalledTimes(1);
    const [passed, score] = submitEvaluation.mock.calls[0];
    expect(passed).toBe(true);
    expect(score).toBe(100);
  });

  it('a wrong order does NOT submit and its hint names no order; a placed card can be tapped back out (undo)', () => {
    render(<HowItWorks data={makeData()} />);
    start();
    placeTray('p2'); placeTray('p1'); placeTray('p0'); // reversed = wrong
    expect(submitEvaluation).not.toHaveBeenCalled();
    const wrong = sendText.mock.calls.find(c => String(c[0]).includes('[CHALLENGE_INCORRECT]'));
    expect(wrong, 'wrong-order hint should fire').toBeTruthy();
    expect(String(wrong![0])).not.toContain('The truck tows the car away.');
    // The cards go back to the tray for another try.
    expect(document.querySelector('[data-step-id="p0"]')).toBeTruthy();
    placeTray('p0');
    expect(document.querySelector('[data-step-id="p0"]')).toBeNull();
    act(() => { fireEvent.click(screen.getByLabelText('Take back Car stops')); });
    expect(document.querySelector('[data-step-id="p0"]'), 'card returns to tray after undo').toBeTruthy();
  });
});
