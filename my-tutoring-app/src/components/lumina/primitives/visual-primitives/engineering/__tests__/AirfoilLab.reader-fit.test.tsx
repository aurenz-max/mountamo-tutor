// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for airfoil-lab's young-learner read-aloud
 * wiring. Every load-bearing string here (the airfoil description, the compare
 * question + its explanation, the challenge task + its hint, and the "How Wings
 * Create Lift" lift/stall explanation) is text a K–2 reader cannot decode; the
 * fix gives each a 🔊 LuminaReadAloud / ReadMeButton that routes to a NON-silent
 * sendText — the read-aloud IS the tutor speaking the words verbatim.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends
 * the right read-this-aloud message (the compare question is answer-free; the
 * explanation/hint are already revealed on the card, so voicing them is fine).
 * External hooks are mocked to drive pure component logic. The canvas
 * sub-component is inert in jsdom (getContext returns null, handled gracefully).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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

import AirfoilLab, { type AirfoilLabData } from '../AirfoilLab';

const DESCRIPTION = 'A gently curved wing that sends the air above it racing over the top.';
const COMPARE_Q = 'Which wing do you think makes more lift, the flat one or the curved one?';
const COMPARE_EXP = 'The curved wing makes more lift because the air over the top speeds up.';
const CHALLENGE = 'Make a wing that lifts a heavy glider without slowing it down.';
const HINT = 'A curved wing at a gentle tilt keeps the air smooth.';

const data = (): AirfoilLabData => ({
  airfoil: { shape: 'cambered', name: 'Curved Wing', description: DESCRIPTION },
  initialConditions: { angleOfAttack: 2, windSpeed: 20, airDensity: 1.225 },
  results: {
    liftCoefficient: 0.5,
    dragCoefficient: 0.02,
    liftForce: 100,
    dragForce: 5,
    stallAngle: 15,
  },
  presetComparisons: [
    {
      name: 'Flat vs Curved',
      airfoilA: 'flat',
      airfoilB: 'cambered',
      question: COMPARE_Q,
      explanation: COMPARE_EXP,
    },
  ],
  challenges: [
    { scenario: CHALLENGE, targetLift: 'high', targetDrag: 'low', hint: HINT },
  ],
  visualizationOptions: {
    streamlines: true,
    pressureMap: true,
    velocityMap: false,
    particleMode: true,
    forceGauges: true,
    stallVisualization: true,
  },
  gradeBand: '1-2',
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('AirfoilLab reader-fit (young-learner read-aloud)', () => {
  it('the description 🔊 reads the airfoil description verbatim', () => {
    render(<AirfoilLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the description to me/i }));
    expect(sentMessages().some((m) => m.includes(DESCRIPTION) && /\[READ_INTRO\]/.test(m))).toBe(true);
  });

  it('the "How Wings Create Lift" 🔊 reads the lift/stall explanation', () => {
    render(<AirfoilLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read how wings make lift to me/i }));
    const msg = sentMessages().find((m) => /\[READ_HOW_LIFT\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/lower pressure/i);
    expect(msg).toMatch(/lift collapses/i);
  });

  it('the compare question 🔊 reads the question verbatim and never leaks the explanation', () => {
    render(<AirfoilLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /^compare$/i })); // reveal preset comparisons
    fireEvent.click(screen.getByRole('button', { name: /read the question to me/i }));
    const msg = sentMessages().find((m) => m.includes(COMPARE_Q));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/\[READ_COMPARE_Q\]/);
    expect(msg).not.toContain(COMPARE_EXP); // never voice the answer explanation with the question
  });

  it('the compare explanation 🔊 reads the revealed explanation verbatim', () => {
    render(<AirfoilLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /^compare$/i }));
    fireEvent.click(screen.getByRole('button', { name: /read the explanation to me/i }));
    expect(sentMessages().some((m) => m.includes(COMPARE_EXP) && /\[READ_COMPARE_EXPLANATION\]/.test(m))).toBe(true);
  });

  it('the challenge 🔊 reads the task + an answer-free ask (restates the visible goal, not a solution)', () => {
    render(<AirfoilLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the challenge to me/i }));
    const msg = sentMessages().find((m) => m.includes(CHALLENGE));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/\[READ_CHALLENGE\]/);
    expect(msg).toMatch(/check my solution/i); // tells a non-reader what to do
  });

  it('after selecting a challenge, the hint 🔊 reads the hint verbatim', () => {
    render(<AirfoilLab data={data()} />);
    fireEvent.click(screen.getByText(CHALLENGE)); // activate the challenge card
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the hint to me/i }));
    expect(sentMessages().some((m) => m.includes(HINT) && /\[READ_HINT\]/.test(m))).toBe(true);
  });
});
