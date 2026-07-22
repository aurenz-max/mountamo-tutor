// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for engine-explorer's young-learner
 * read-aloud wiring. Every load-bearing string here (overview, selected-zone
 * explanation + analogy, challenge instruction, post-answer hint) is text a K–2
 * reader cannot decode; the fix gives each a 🔊 LuminaReadAloud / ReadMeButton
 * that routes to a NON-silent sendText — the read-aloud IS the tutor speaking
 * the words verbatim.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends
 * the right read-this-aloud message (overview/zone/hint are non-graded or
 * already-revealed so reading verbatim is fine; the challenge instruction is a
 * question, so its ReadMeButton is answer-free). External hooks are mocked to
 * drive pure component logic.
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

import EngineExplorer, { type EngineExplorerData } from '../EngineExplorer';

const OVERVIEW = 'This is a real steam engine that once pulled trains across the land.';
const ZONE_EXPLANATION = 'Water is heated by burning coal until it turns into steam.';
const ZONE_ANALOGY = 'Like a giant kettle on a stove.';
const CHALLENGE_Q = 'What happens to the tiny drops when you add more coal?';
const WRONG_ANSWER = 'They slow down and clump together';
const RIGHT_ANSWER = 'They speed up and spread apart';
const HINT = 'Think about what happens to water when you heat it on the stove.';

const data = (): EngineExplorerData => ({
  title: 'The Living Steam Engine',
  description: 'Explore how a steam engine turns fire into motion.',
  engineType: 'steam',
  engineName: 'Big Iron Steam Engine',
  vehicleContext: 'a train',
  overview: OVERVIEW,
  gradeBand: '1-2',
  zoneDescriptions: {
    boiler: { analogy: ZONE_ANALOGY, explanation: ZONE_EXPLANATION },
  },
  challenges: [
    {
      id: 'ch1',
      type: 'predict',
      instruction: CHALLENGE_Q,
      options: [
        { id: 'a', text: WRONG_ANSWER },
        { id: 'b', text: RIGHT_ANSWER },
        { id: 'c', text: 'They stay the same' },
        { id: 'd', text: 'They disappear' },
      ],
      correctOptionId: 'b',
      hint: HINT,
    },
  ],
  energyFlow: {
    input: 'Coal',
    transformations: ['Heat', 'Steam'],
    output: 'Motion',
    efficiency: null,
    losses: [],
  },
  observeNarration: 'Watch the drops dance in the boiler.',
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('EngineExplorer reader-fit (young-learner read-aloud)', () => {
  it('the overview 🔊 button is present in the header and reads the overview verbatim', () => {
    render(<EngineExplorer data={data()} />);
    const btn = screen.getByRole('button', { name: /read the overview to me/i });
    expect(btn).toBeTruthy();
    sendTextSpy.mockClear();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(OVERVIEW) && /\[READ_OVERVIEW\]/.test(m))).toBe(true);
  });

  it('tapping the boiler zone reveals a 🔊 that reads its explanation + analogy verbatim', () => {
    const { container } = render(<EngineExplorer data={data()} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    // jsdom gives a 0×0 canvas; stub the client rect so the hit-test maps 1:1
    // to the internal 640×400 coordinate space (boiler bounds x40 y50 w120 h180).
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 640, height: 400, right: 640, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.click(canvas, { clientX: 100, clientY: 100 }); // inside the boiler
    sendTextSpy.mockClear(); // drop the silent [ZONE_EXPLORED] narration
    const btn = screen.getByRole('button', { name: /read this part to me/i });
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => /\[READ_ZONE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(ZONE_EXPLANATION);
    expect(msg).toContain(ZONE_ANALOGY);
  });

  it('the challenge instruction 🔊 reads the question verbatim and never names the answer', () => {
    render(<EngineExplorer data={data()} />);
    // Open the challenge section.
    fireEvent.click(screen.getByRole('button', { name: /ready for a challenge/i }));
    sendTextSpy.mockClear();
    const btn = screen.getByRole('button', { name: /read the question to me/i });
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => m.includes(CHALLENGE_Q) && /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    // Answer-free: never leaks the correct option text.
    expect(msg).not.toContain(RIGHT_ANSWER);
    expect(msg).not.toContain(WRONG_ANSWER);
  });

  it('after a wrong answer, the hint 🔊 button appears and reads the hint verbatim', () => {
    render(<EngineExplorer data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /ready for a challenge/i }));
    // Choose the wrong option to reveal the hint.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(WRONG_ANSWER, 'i') }));
    const btn = screen.getByRole('button', { name: /read the hint to me/i });
    expect(btn).toBeTruthy();
    sendTextSpy.mockClear();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(HINT) && /\[READ_HINT\]/.test(m))).toBe(true);
  });
});
