// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for paper-airplane-designer's young-learner
 * read-aloud wiring. This is a build → launch → analyze → iterate design lab; its
 * load-bearing text — the lab instructions (description), each challenge goal + hint,
 * and the Design Tips coaching prose — is text a K–2 reader cannot decode. The fix
 * gives each a 🔊 LuminaReadAloud / ReadMeButton routing to a NON-silent sendText —
 * the read-aloud IS the tutor speaking the words verbatim. Nothing here is a graded
 * MCQ, so reading goals/hints/tips verbatim is answer-safe.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends the
 * right read-this-aloud message. External hooks are mocked to drive pure component
 * logic; requestAnimationFrame is stubbed synchronous so the flight animation lands
 * in the analyze phase where the challenges render.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Radix Slider (used by the Design Controls) reaches for ResizeObserver, which
// jsdom does not implement — a no-op stub is enough to mount the component.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    hasSubmittedEvaluation: false,
    resetAttempt: vi.fn(),
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import PaperAirplaneDesigner, { type PaperAirplaneDesignerData } from '../PaperAirplaneDesigner';

const DESCRIPTION = 'Build a paper airplane, throw it, and make it fly far!';
const CH_NAME = 'Distance Champ';
const CH_GOAL = 'Make your plane fly at least ten meters.';
const CH_HINT = 'Try a pointy nose and a gentle toss.';

const data = (): PaperAirplaneDesignerData => ({
  title: 'Paper Airplane Lab',
  description: DESCRIPTION,
  template: { name: 'dart', description: 'fast and straight', baseFolds: 6, imagePrompt: 'a dart plane' },
  designParameters: {
    noseAngle: { value: 25, adjustable: true, min: 15, max: 45 },
    wingSpan: { value: 12, adjustable: true, min: 8, max: 20 },
    wingAngle: { value: 5, adjustable: true, min: 0, max: 30 },
    hasWinglets: false,
    hasElevatorTab: false,
    noseWeight: { value: 0, adjustable: true },
  },
  launchSettings: {
    angle: { value: 30, adjustable: true, min: 0, max: 60 },
    force: { value: 5, adjustable: true, min: 1, max: 10 },
    windSpeed: 0,
    windDirection: 0,
  },
  challenges: [
    { id: 'dist', name: CH_NAME, goal: CH_GOAL, targetMetric: 'distance', targetValue: 10, hint: CH_HINT, maxAttempts: null },
  ],
  gradeBand: 'K-2',
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
  // Drive the rAF flight animation to completion synchronously so a single launch
  // click lands the component in the analyze phase (where challenges render).
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PaperAirplaneDesigner reader-fit (young-learner read-aloud)', () => {
  it('the lab instructions 🔊 reads the description verbatim', () => {
    render(<PaperAirplaneDesigner data={data()} />);
    const btn = screen.getByRole('button', { name: /read the instructions to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(DESCRIPTION) && /\[READ_DESCRIPTION\]/.test(m))).toBe(true);
  });

  it('the Design Tips 🔊 reads the coaching prose verbatim', () => {
    render(<PaperAirplaneDesigner data={data()} />);
    const btn = screen.getByRole('button', { name: /read the design tips to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => /\[READ_TIPS\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/less air resistance/i);
    expect(msg).toMatch(/change one thing at a time/i);
  });

  it('analyze: each challenge 🔊 reads the challenge name + goal (and its hint) verbatim', () => {
    render(<PaperAirplaneDesigner data={data()} />);
    // Launch a flight → the synchronous rAF stub completes the animation → analyze phase.
    fireEvent.click(screen.getByRole('button', { name: /launch flight/i }));
    sendTextSpy.mockClear(); // drop the silent [FIRST_FLIGHT]/[CHALLENGE_*] coaching turns
    const btn = screen.getByRole('button', { name: /read the challenge to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(CH_NAME);
    expect(msg).toContain(CH_GOAL);
    expect(msg).toContain(CH_HINT);
  });
});
