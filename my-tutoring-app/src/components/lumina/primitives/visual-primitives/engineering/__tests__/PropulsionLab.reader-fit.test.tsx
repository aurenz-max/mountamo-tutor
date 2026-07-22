// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for propulsion-lab's young-learner
 * read-aloud wiring. The lab carries load-bearing text a K–2 reader cannot
 * decode — the overview, the propulsion "how it works" line, the Key Discovery
 * synthesis, the challenge question, and the after-wrong-answer hint. The fix
 * gives each a 🔊 LuminaReadAloud / ReadMeButton routing to a NON-silent
 * sendText — the read-aloud IS the tutor speaking the words verbatim.
 *
 * QUESTION strings route through ReadMeButton (question + answer-free ask,
 * never the correct option). These are the behaviors tsc can't verify: the
 * buttons render, and a tap sends the right read-this-aloud message.
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

import PropulsionLab, { type PropulsionLabData } from '../PropulsionLab';

const OVERVIEW = 'Try different engines in air, water, and space to see how push works.';
const CH_INSTRUCTION = 'Set the propeller in space. What do you think happens when you push the throttle?';
const CH_CORRECT = 'Nothing happens because there is no air to push!';
const CH_HINT = 'A propeller pushes air backward. What if there is no air?';

const data = (): PropulsionLabData => ({
  title: 'Propulsion Lab',
  description: 'Explore how engines push.',
  overview: OVERVIEW,
  gradeBand: '1-2',
  challenges: [
    {
      id: 'ch1',
      type: 'predict',
      instruction: CH_INSTRUCTION,
      options: [
        { id: 'a', text: 'It pushes the vehicle forward like normal' },
        { id: 'b', text: CH_CORRECT },
        { id: 'c', text: 'The vehicle goes backward' },
        { id: 'd', text: 'The propeller spins and it explodes' },
      ],
      correctOptionId: 'b',
      hint: CH_HINT,
    },
  ],
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('PropulsionLab reader-fit (young-learner read-aloud)', () => {
  it('header: a 🔊 reads the overview verbatim', () => {
    render(<PropulsionLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the overview to me/i }));
    const msg = sentMessages().find((m) => /\[READ_OVERVIEW\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(OVERVIEW);
  });

  it('controls: a 🔊 reads how the current propulsion works', () => {
    render(<PropulsionLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read how this propulsion works to me/i }));
    const msg = sentMessages().find((m) => /\[READ_PROPULSION\]/.test(m));
    expect(msg).toBeTruthy();
    // Default propulsion is the jet — its pushesAgainst line is read verbatim.
    expect(msg).toMatch(/blasts it out faster/i);
  });

  it('challenge: the question 🔊 reads the instruction + an answer-free ask, never the correct option', () => {
    render(<PropulsionLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /ready for a challenge/i }));
    fireEvent.click(screen.getByRole('button', { name: /read the question to me/i }));
    const msg = sentMessages().find((m) => /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(CH_INSTRUCTION);
    expect(msg).toMatch(/tap the choice/i);
    // Answer safety: the correct option text is never voiced.
    expect(msg).not.toContain(CH_CORRECT);
  });

  it('challenge: after a wrong answer, the hint 🔊 reads the hint verbatim', () => {
    render(<PropulsionLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /ready for a challenge/i }));
    // Pick a wrong option to reveal the hint.
    fireEvent.click(screen.getByRole('button', { name: /pushes the vehicle forward like normal/i }));
    sendTextSpy.mockClear(); // drop the silent [CHALLENGE_INCORRECT] message
    fireEvent.click(screen.getByRole('button', { name: /read the hint to me/i }));
    const msg = sentMessages().find((m) => /\[READ_HINT\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(CH_HINT);
  });
});
