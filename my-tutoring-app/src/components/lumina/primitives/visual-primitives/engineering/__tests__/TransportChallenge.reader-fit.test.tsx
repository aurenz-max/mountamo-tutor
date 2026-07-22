// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for transport-challenge's young-learner
 * read-aloud wiring. Every scenario carries load-bearing prose a K–2 reader
 * cannot decode — the lesson intro, the scenario task (title + who moves where),
 * the trade-off QUESTION, and the post-answer explanation. The fix gives each a
 * 🔊 LuminaReadAloud / ReadMeButton routing to a NON-silent sendText — the
 * read-aloud IS the tutor speaking the words verbatim.
 *
 * Answer-safety: the question uses ReadMeButton (verbatim question + answer-free
 * ask, never the correct option); the explanation is only read after it is
 * already revealed on screen. These are the behaviors tsc can't verify: the
 * buttons render, a tap sends the right read-this-aloud message, and the question
 * read-aloud never leaks the answer. External hooks are mocked to drive logic.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
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

import TransportChallenge, { type TransportChallengeData } from '../TransportChallenge';

const INTRO = 'Plan the smartest way to move people from place to place!';
const SCENARIO_TITLE = 'Get the team to the big game';
const QUESTION = 'Why did the bigger bus finish sooner even though it costs more per trip?';
const CORRECT_OPTION = 'It carries more people, so it needs fewer trips.';
const EXPLANATION = 'The bus fits more people per trip, so it made fewer trips and finished faster.';

const data = (): TransportChallengeData => ({
  title: 'Transport Challenge',
  description: INTRO,
  scenarios: [
    {
      id: 's1',
      type: 'multi_constraint',
      title: SCENARIO_TITLE,
      origin: 'Riverside',
      destination: 'Stadium',
      distanceKm: 30,
      peopleToTransport: 40,
      constraints: [
        { type: 'budget', limit: 500, unit: 'dollars' },
        { type: 'time', limit: 120, unit: 'minutes' },
      ],
      vehicles: [
        {
          id: 'van', name: 'Van', emoji: '🚐', capacity: 8, speedKmh: 60,
          costPerTrip: 40, co2PerTrip: 10, turnaroundMinutes: 10, color: '#60a5fa',
        },
        {
          id: 'bus', name: 'Bus', emoji: '🚌', capacity: 40, speedKmh: 55,
          costPerTrip: 120, co2PerTrip: 30, turnaroundMinutes: 15, color: '#34d399',
        },
      ],
      bestVehicleId: 'bus',
      acceptableVehicleIds: ['bus'],
      tradeOffQuestion: QUESTION,
      tradeOffOptions: [
        'It drives much faster than every other vehicle.',
        CORRECT_OPTION,
      ],
      tradeOffCorrectIndex: 1,
      explanation: EXPLANATION,
    },
  ],
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

// Drive the scenario forward to the answered phase so the explanation renders.
function reachAnsweredPhase() {
  // Pick a vehicle, start the sim.
  fireEvent.click(screen.getByRole('button', { name: /bus/i }));
  fireEvent.click(screen.getByRole('button', { name: /start transport/i }));
  // The sim advances on a setInterval that reads Date.now(); fast-forward the
  // faked clock inside act() so the phase→results state update flushes.
  act(() => {
    vi.advanceTimersByTime(35_000);
  });
  // Move to the question.
  fireEvent.click(screen.getByRole('button', { name: /answer trade-off question/i }));
  // Answer correctly → answered phase reveals the explanation.
  fireEvent.click(screen.getByText(CORRECT_OPTION));
  fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));
}

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('TransportChallenge reader-fit (young-learner read-aloud)', () => {
  it('intro: a 🔊 reads the lesson description verbatim', () => {
    render(<TransportChallenge data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the lesson intro to me/i }));
    const msg = sentMessages().find((m) => /\[READ_INTRO\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(INTRO);
  });

  it('scenario: the task 🔊 reads the setup + an answer-free ask, never naming the best vehicle', () => {
    render(<TransportChallenge data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the transport task to me/i }));
    const msg = sentMessages().find((m) => /\[READ_SCENARIO\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(SCENARIO_TITLE);
    expect(msg).toMatch(/choose a vehicle for the job/i);
    // Answer-safety: the task read-aloud must not name the best vehicle answer.
    expect(msg).not.toMatch(/It carries more people/i);
  });

  it('question: the 🔊 reads the trade-off question but NEVER the correct answer', () => {
    vi.useFakeTimers();
    try {
      render(<TransportChallenge data={data()} />);
      reachAnsweredPhase();
      sendTextSpy.mockClear(); // drop silent [ANSWER_*] messages
      fireEvent.click(screen.getByRole('button', { name: /read the question to me/i }));
      const msg = sentMessages().find((m) => /\[READ_QUESTION\]/.test(m));
      expect(msg).toBeTruthy();
      expect(msg).toContain(QUESTION);
      expect(msg).not.toContain(CORRECT_OPTION);
    } finally {
      vi.useRealTimers();
    }
  });

  it('explanation: after answering, a 🔊 reads the revealed explanation verbatim', () => {
    vi.useFakeTimers();
    try {
      render(<TransportChallenge data={data()} />);
      reachAnsweredPhase();
      sendTextSpy.mockClear();
      fireEvent.click(screen.getByRole('button', { name: /read the explanation to me/i }));
      const msg = sentMessages().find((m) => /\[READ_EXPLANATION\]/.test(m));
      expect(msg).toBeTruthy();
      expect(msg).toContain(EXPLANATION);
    } finally {
      vi.useRealTimers();
    }
  });
});
