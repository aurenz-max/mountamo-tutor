// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for flight-forces-explorer's young-learner
 * read-aloud wiring. Every load-bearing string here (the overview/orient, the
 * prediction/observation question, the challenge hint, and the stall
 * explanation) is text a K–2 reader cannot decode; the fix gives each a 🔊
 * LuminaReadAloud / ReadMeButton that routes to a NON-silent sendText — the
 * read-aloud IS the tutor speaking the words verbatim.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends
 * the right read-this-aloud message (the question ask is answer-free; the hint
 * is only read once revealed). External hooks are mocked to drive pure component
 * logic. The stall-discovery 🔊 is driven by the canvas physics loop (grab +
 * drag past the stall angle) and is not reachable under jsdom — it is verified in
 * the browser pass logged to HUMAN-CHECKS.
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

import FlightForcesExplorer, { type FlightForcesExplorerData } from '../FlightForcesExplorer';

const OVERVIEW = 'Fly the plane and watch the four forces of flight push and pull it.';
const INSTRUCTION = 'What happens to the air above the wing when you tilt the nose up?';
const HINT = 'Watch the little dots above the wing as you tilt the plane.';

const data = (): FlightForcesExplorerData => ({
  title: 'Flying Machines',
  description: 'A living flight lab.',
  overview: OVERVIEW,
  aircraftType: 'cessna',
  aircraftName: 'Little Sky Plane',
  gradeBand: '1-2',
  challenges: [
    {
      id: 'ch1',
      type: 'predict',
      instruction: INSTRUCTION,
      options: [
        { id: 'a', text: 'It speeds up and spreads out' },
        { id: 'b', text: 'Nothing changes at all' },
      ],
      correctOptionId: 'a',
      hint: HINT,
    },
  ],
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('FlightForcesExplorer reader-fit (young-learner read-aloud)', () => {
  it('the overview 🔊 button is present in the header and reads the overview verbatim', () => {
    render(<FlightForcesExplorer data={data()} />);
    const btn = screen.getByRole('button', { name: /read the overview to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(OVERVIEW) && /\[READ_OVERVIEW\]/.test(m))).toBe(true);
  });

  it('the challenge question 🔊 reads the question verbatim + an answer-free ask (never the answer)', () => {
    render(<FlightForcesExplorer data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /ready for a challenge/i }));
    const btn = screen.getByRole('button', { name: /read the question to me/i });
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => m.includes(INSTRUCTION) && /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    // States an answer-free "what to do" so a non-reader knows how to act…
    expect(msg).toMatch(/tap the answer/i);
    // …but never names the correct option text.
    expect(msg).not.toMatch(/speeds up and spreads out/i);
  });

  it('after a wrong answer, the hint 🔊 appears and reads the hint verbatim', () => {
    render(<FlightForcesExplorer data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /ready for a challenge/i }));
    // Answer incorrectly to reveal the hint.
    fireEvent.click(screen.getByRole('button', { name: /nothing changes at all/i }));
    const btn = screen.getByRole('button', { name: /read the hint to me/i });
    expect(btn).toBeTruthy();
    sendTextSpy.mockClear(); // drop the silent [CHALLENGE_INCORRECT] narration
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(HINT) && /\[READ_HINT\]/.test(m))).toBe(true);
  });
});
