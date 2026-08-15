// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for counting-board item 13 (K subitize
 * flash-then-hide DISPLAY fork), REWRITTEN onto the DI-port surface
 * (2026-08-10): the stepper and Check Answer died with the port — the answer
 * is spoken and the tutor's affirmation advances — but what item 13 protects
 * is unchanged and still pinned here:
 *  1. K `subitize` flashes the objects briefly, then HIDES them before the
 *     child answers. Hidden or flashing objects are never tap-countable —
 *     genuine subitizing is instant recognition, not tap-counting.
 *  2. K `count_all` keeps visible, tappable objects (the working surface);
 *     taps register the child's own count trace.
 *  3. Grade-1 `subitize` keeps its objects visible (no flash gating on
 *     reader grades).
 * Port render gates ride along: no Check / Next / stepper anywhere.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: true,
  isAudioPlaying: false,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText: vi.fn(),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));
// The engine is inert-stubbed: these tests drive DISPLAY behavior (flash,
// visibility, tap-counting), not the judged loop, and the real voice hook
// would touch audio APIs jsdom does not have once a run starts.
vi.mock('../../../../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: { onCue?: (e: { phase: string; text: string }) => void }) => ({
    voiceTurns: {},
    queueCue: vi.fn(),
    submitGestureAttempt: vi.fn(),
    // A cue that reaches the floor is what tells the runner WHICH item the
    // tutor's live line is about; the stimulus gate will not open without it.
    sendCueNow: vi.fn((text: string) => options.onCue?.({ phase: 'sent', text })),
    clearQueuedCue: vi.fn(),
    arm: vi.fn(),
    disarm: vi.fn(),
    reset: vi.fn(),
    isAwaitingJudgment: () => false,
    config: {},
  }),
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

// Object groups are the ONLY tappable <g class="cursor-pointer"> in the
// workspace; subitize modes render their <g> without the class (not tappable).
const tappableObjects = () => document.querySelectorAll('g.cursor-pointer');
// Object emoji glyphs render at font-size 24; badges at 11 — this counts the
// OBJECTS on screen without picking up count-badge text.
const allObjects = () => document.querySelectorAll('svg text[font-size="24"]');
// A counted object stamps a yellow count-badge circle (#eab308); its absence
// proves a tap never registered a count.
const countBadges = () => document.querySelectorAll('circle[fill="#eab308"]');

/** Tap the mic's start affordance — the ONE start gesture the port allows.
 *  Real timers: prepareLive polls the mic on a 100ms sleep, and the flash
 *  runs on real timeouts — waitFor below observes both honestly. */
const startRun = async () => {
  await act(async () => {
    fireEvent.click(screen.getByLabelText('Tap to start'));
  });
  // Two acts, deliberately: the mic poll only observes isListening through a
  // COMMITTED re-render, and renders do not commit mid-act — one merged block
  // leaves start() polling forever.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
};

beforeEach(() => {
  cleanup();
  // The start button only renders while the mic is idle.
  ctxState.isListening = false;
  ctxState.isAudioPlaying = false;
  // jsdom has no mediaDevices; the mic renders null without this stub.
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  });
});
afterEach(() => cleanup());

describe('CountingBoard reader-fit item 13 (DI surface)', () => {
  /**
   * ⭐ 19c CHANGED THIS TEST, AND THE CHANGE IS THE POINT. Until 2026-08-15 this
   * port started its flash on an 800ms beat measured from item-open — exactly
   * the defect ten-frame drive 3 heard ("it flashes then she instructs, this
   * would be confusing for the child"), still live here because that fix had
   * been written into ONE component instead of into the runner. Absorbing the
   * gate fixed it for free, and this suite drives the REAL runner, so it can
   * assert it: the board stays dark under her voice, however long she takes.
   */
  it('K subitize: waits for the tutor, then flashes and hides; never tap-countable', async () => {
    const fixture = data('K', [challenge('s1', 'subitize', 4), challenge('s2', 'subitize', 3)]);
    const { rerender } = render(<CountingBoard data={fixture} />);
    const repaint = async () => {
      await act(async () => { rerender(<CountingBoard data={fixture} />); });
    };

    // Pre-run: nothing flashes yet and the objects stay hidden.
    expect(allObjects()).toHaveLength(0);

    await startRun();

    // Her line is out and she is SPEAKING it. The board must stay dark.
    ctxState.isAudioPlaying = true;
    await repaint();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1200)); });
    expect(allObjects()).toHaveLength(0);

    // She stops. A breath, then the objects flash in — but NOT as tappables.
    ctxState.isAudioPlaying = false;
    await repaint();
    await waitFor(() => expect(allObjects()).toHaveLength(4), { timeout: 2500 });
    expect(tappableObjects()).toHaveLength(0);
    expect(countBadges()).toHaveLength(0);

    // Flash ends → objects hide again; "Show again" re-shows the STIMULUS.
    await waitFor(() => expect(allObjects()).toHaveLength(0), { timeout: 3000 });
    expect(screen.getByText('Show again')).toBeTruthy();
  });

  it('K count_all: objects stay visible and tapping counts them during a run', async () => {
    render(<CountingBoard data={data('K', [
      challenge('c1', 'count_all', 3),
      challenge('c2', 'count_all', 4),
    ])} />);

    // Objects are visible immediately (no flash gate).
    expect(allObjects()).toHaveLength(3);

    await startRun();
    fireEvent.click(tappableObjects()[0]);
    fireEvent.click(tappableObjects()[1]);
    fireEvent.click(tappableObjects()[2]);
    // Three taps registered three counted objects — the child's own trace.
    expect(countBadges()).toHaveLength(3);
    // The tally shows the child's count only, never "/ total".
    expect(screen.getByText(/counted:/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain('/ 3');
  });

  it('Grade-1 subitize keeps objects visible; no stepper or advance button exists', () => {
    render(<CountingBoard data={data('1', [
      challenge('g1', 'subitize', 5),
      challenge('g2', 'subitize', 4),
    ])} />);

    // No flash gating on reader grades: objects present at once.
    expect(allObjects()).toHaveLength(5);
    // The DI port's render gates: no stepper, no Check, no Next — anywhere.
    expect(screen.queryByText('−')).toBeNull();
    expect(screen.queryByText('+')).toBeNull();
    expect(screen.queryByText(/check answer/i)).toBeNull();
    expect(screen.queryByText(/next challenge/i)).toBeNull();
    expect(screen.getByLabelText('Tap to start')).toBeTruthy();
  });
});
