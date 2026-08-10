// @vitest-environment jsdom
/**
 * CountingBoard render contract after the DI port (first non-literacy
 * consumer of useJudgedScriptRunner).
 *
 * What this locks in:
 *  1. No button carries the child forward at any grade: no Check Answer, no
 *     Next Challenge, no Try Again, no −/+ numeral steppers. The tutor owns
 *     every transition.
 *  2. ANSWER-LEAK: the running tally never prints "/ total" (that typeset the
 *     answer next to the child's progress), the reward chip is absent before
 *     an affirmation, and success/failure text never names the target.
 *  3. Adult chrome (counter, grade/mode badges, description, instruction,
 *     reader hint) is hidden at gradeBand 'K' — a pre-reader gets the task by
 *     voice.
 *  4. The Pre-K hand picker renders three hands with no numerals anywhere.
 *  5. The mic affordance is the ONE start gesture.
 *
 * The live loop is NOT driven here — it cannot be done honestly in jsdom
 * (see SoundSwap.di.test.tsx). The progression policy has its own suite
 * (useJudgedScriptRunner.test.tsx); the pedagogy lives in
 * countingBoardScript.di-script.test.ts.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: false,
  isAudioPlaying: false,
  micLevel: 0,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import CountingBoard, {
  type CountingBoardChallenge,
  type CountingBoardData,
} from './CountingBoard';

const COUNT_CHALLENGE: CountingBoardChallenge = {
  id: 'c1',
  type: 'count_all',
  instruction: 'Can you count all the bears?',
  targetAnswer: 5,
  count: 5,
  arrangement: 'line',
  hint: 'Touch each one as you count!',
  narration: 'Count the bears together.',
};

const HANDS_CHALLENGE: CountingBoardChallenge = {
  id: 'h1',
  type: 'subitize_perceptual',
  instruction: 'How many do you see?',
  targetAnswer: 2,
  count: 2,
  arrangement: 'scattered',
  hint: 'Look quickly!',
  narration: 'Look at the stars.',
};

const makeData = (
  gradeBand: 'K' | '1',
  challenges: CountingBoardChallenge[] = [COUNT_CHALLENGE],
): CountingBoardData => ({
  title: 'Counting Time',
  description: 'Count the bears on the board.',
  objects: { type: 'bears' },
  challenges,
  gradeBand,
});

beforeEach(() => {
  sendText.mockClear();
  ctxState.isListening = false;
});
afterEach(cleanup);

describe('no self-advance affordance at any grade', () => {
  it.each(['K', '1'] as const)('gradeBand %s has no Check / Next / Try Again / steppers', (band) => {
    render(<CountingBoard data={makeData(band)} />);
    expect(screen.queryByText(/check answer/i)).toBeNull();
    expect(screen.queryByText(/next challenge/i)).toBeNull();
    expect(screen.queryByText(/try again/i)).toBeNull();
    expect(screen.queryByText('−')).toBeNull();
    expect(screen.queryByText('+')).toBeNull();
    expect(screen.queryByText(/show spelling|skip/i)).toBeNull();
  });

  it('the mic start affordance is present', () => {
    // jsdom has no mediaDevices; the mic renders null without this stub.
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });
    render(<CountingBoard data={makeData('K')} />);
    expect(screen.getByLabelText('Tap to start')).toBeTruthy();
  });
});

describe('answer-leak gates', () => {
  it('never prints a "/ total" tally', () => {
    const { container } = render(<CountingBoard data={makeData('1')} />);
    expect(container.textContent).not.toContain('/ 5');
  });

  it('shows no reward chip before an affirmation', () => {
    render(<CountingBoard data={makeData('1')} />);
    expect(screen.queryByText(/five bears!/i)).toBeNull();
    expect(screen.queryByText(/that hand matches!/i)).toBeNull();
  });

  it('the Pre-K hand picker has three hands and no numerals in its section', () => {
    render(<CountingBoard data={makeData('K', [HANDS_CHALLENGE])} />);
    const hands = screen.getAllByLabelText('Pick this hand');
    expect(hands).toHaveLength(3);
    for (const hand of hands) {
      expect(hand.textContent ?? '').not.toMatch(/\d/);
    }
    expect(screen.getByText('Which hand shows how many you saw?')).toBeTruthy();
  });
});

describe('pre-reader chrome gate', () => {
  it('K hides counter, badges, description, instruction and the reader hint', () => {
    render(<CountingBoard data={makeData('K')} />);
    expect(screen.queryByText('Kindergarten')).toBeNull();
    expect(screen.queryByText(/count all/i)).toBeNull();
    expect(screen.queryByText('Count the bears on the board.')).toBeNull();
    expect(screen.queryByText('Can you count all the bears?')).toBeNull();
    expect(screen.queryByText(/tap each object as you count/i)).toBeNull();
  });

  it('Grade 1 keeps the reader chrome', () => {
    render(<CountingBoard data={makeData('1')} />);
    expect(screen.getByText('Grade 1')).toBeTruthy();
    expect(screen.getByText('Can you count all the bears?')).toBeTruthy();
  });
});
