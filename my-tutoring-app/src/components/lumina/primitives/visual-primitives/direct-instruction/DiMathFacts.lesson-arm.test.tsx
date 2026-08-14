// @vitest-environment jsdom
/**
 * LESSON-MODE ARMING — reproduction of the first live lesson sitting with DI
 * integrated (session ef24bc78b310 / run 967e2399f310, 2026-08-06).
 *
 * What the run log showed: 3 cues sent, 12 voice turns closed (9 of them well
 * above the voice bar), 247 tutor lines — and `attempts: 0`. Every emission the
 * HOOK produces (session-resumed, session-dead) is in the timeline; every
 * emission the REDUCER produces is absent. That is the signature of
 * `state.armed === false` for the whole run: `voice-close`, `transcript` and
 * `tutor-text` all return untouched when unarmed, so the child answered "eleven"
 * correctly, the tutor said "Yes, the number after ten is eleven." — and the
 * pack never advanced off item 1.
 *
 * Unlike the other DI tests, this one mounts the REAL engine (useJudgedSpeechLoop
 * + judgedLoopModel) against a lesson-mode context with shared voice turns. The
 * mocked-engine tests cannot see this class of bug: they hand the pack an `arm`
 * that is `vi.fn()`.
 */
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_VOICE_TURN_CONFIG } from '../../../hooks/voiceTurnMachine';

// ── The lesson provider's shared voice-turn authority ──────────────────────
let sharedClose: ((event: Record<string, unknown>) => void) | undefined;
const shared = {
  subscribe: (listener: { onTurnClose?: (event: Record<string, unknown>) => void }) => {
    sharedClose = listener.onTurnClose;
    return () => { sharedClose = undefined; };
  },
  isVoiceActive: () => false,
  reset: vi.fn(),
  lastTurnOpenAtRef: { current: null },
  floorsRef: { current: { ambientRms: 0, echoRms: 0 } },
  config: DEFAULT_VOICE_TURN_CONFIG,
};

const sendText = vi.fn();
// A lesson session: already connected, mic already open (the provider owns it).
const ctxState = {
  isConnected: true,
  isListening: true,
  isAudioPlaying: false,
  sessionMode: 'lesson' as const,
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
};
vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
  // NOTE: a fresh object every call, exactly like the real provider (its
  // `value` is built inline on every render, not memoized).
  useLuminaAIContext: () => ({
    ...ctxState,
    sharedVoiceTurns: shared,
    sendText,
    connect: vi.fn(), disconnect: vi.fn(), reconnect: vi.fn(),
    startListening: vi.fn(), stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));

// Tap the pure reducer so the test can see the armed flag each event was
// judged against — the one fact the run log can only imply.
const reducerCalls: Array<{ type: string; armed: boolean }> = [];
vi.mock('../../../hooks/judgedLoopModel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/judgedLoopModel')>();
  return {
    ...actual,
    reduceJudgedLoop: (state: any, event: any, config: any) => {
      reducerCalls.push({ type: event.type, armed: state.armed });
      return actual.reduceJudgedLoop(state, event, config);
    },
  };
});

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(), hasSubmitted: false, submittedResult: null,
    elapsedMs: 0, resetAttempt: vi.fn(),
  }),
  useEvaluationContext: () => null,
}));

// Run-log upload is fire-and-forget network; keep it out of the test.
vi.mock('./diRunLog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./diRunLog')>();
  return { ...actual, flushDiRunLog: vi.fn(async () => {}) };
});

import { DiMathFacts } from './DiMathFacts';
import type { DiMathFactsChallenge } from './diMathFactsScript';

/** The counting_next items from the live sitting. */
const CHALLENGES: DiMathFactsChallenge[] = [
  {
    id: 'dimf-1-n10', challengeType: 'counting_next', a: 10, b: 1,
    display: '10 →', problem: 'the number after ten',
    answerWord: 'eleven', answerNumeral: 11, solvedDisplay: '10 → 11',
    supportTier: 'hard',
  },
  {
    id: 'dimf-2-n4', challengeType: 'counting_next', a: 4, b: 1,
    display: '4 →', problem: 'the number after four',
    answerWord: 'five', answerNumeral: 5, solvedDisplay: '4 → 5',
    supportTier: 'hard',
  },
];

const PACK_DATA = {
  title: 'Super Sequence Practice',
  description: 'Say out loud the next number.',
  challenges: CHALLENGES,
  challengeType: 'counting_next' as const,
  gradeLevel: 'grade 1',
  instanceId: 'obj2-next-number',
};

/** The learner spoke — a turn well above the voice bar, like the live run's. */
const learnerSpoke = () => act(() => {
  sharedClose?.({
    kind: 'close',
    startedAt: 100,
    durationMs: 1286,
    voicedMs: 1371,
    peak: 0.0117,
    duringTutorAudio: false,
    belowMinVoice: false,
  });
});

/** The tutor affirms, in the DI sentinel form the judge contract requires. */
const tutorSays = (text: string, view: ReturnType<typeof render>) => act(() => {
  ctxState.isAudioPlaying = true;
  ctxState.conversation = [...ctxState.conversation, { role: 'assistant', content: text }];
  view.rerender(<DiMathFacts data={PACK_DATA} />);
});

describe('DiMathFacts — lesson-mode arming (live sitting 2026-08-06)', () => {
  beforeEach(() => {
    sendText.mockClear();
    ctxState.conversation = [];
    ctxState.isAudioPlaying = false;
    // The pack hides the mic surface entirely without getUserMedia.
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });
  afterEach(cleanup);

  it('arms the judged loop when the run starts, so a voice turn opens an attempt', async () => {
    const view = render(<DiMathFacts data={PACK_DATA} />);

    // The child taps the mic — in a lesson this skips connect and starts the run.
    await act(async () => {
      screen.getByRole('button').click();
      await Promise.resolve();
    });

    // The opening [DI_ITEM] cue went out: the run really did start.
    expect(sendText.mock.calls.some(([text]) => String(text).includes('[DI_ITEM]'))).toBe(true);

    // The child answers. THE BUG: with the loop unarmed this is dropped on the
    // floor — no attempt, so the tutor's verdict has nothing to bind to.
    learnerSpoke();
    tutorSays('Yes, the number after ten is eleven.', view);

    // THE INVARIANT. Live (run 967e2399f310) every one of these arrived at an
    // UNARMED loop, so `attempts` stayed 0 through 9 qualifying voice turns.
    const close = reducerCalls.find((call) => call.type === 'voice-close');
    expect(close, 'no voice-close reached the reducer').toBeTruthy();
    expect(close?.armed, 'voice-close arrived at an UNARMED loop').toBe(true);
    const verdictText = reducerCalls.find((call) => call.type === 'tutor-text');
    expect(verdictText?.armed, 'tutor verdict arrived at an UNARMED loop').toBe(true);

    // The verdict landed: the fact completes in place for the reward beat...
    expect(screen.queryByText('10 → 11')).toBeTruthy();

    // ...and the stage moves on when the tutor's line finishes.
    await act(async () => {
      ctxState.isAudioPlaying = false;
      view.rerender(<DiMathFacts data={PACK_DATA} />);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });
    expect(screen.queryByText('4 →'), 'pack never advanced to item 2').toBeTruthy();
  });
});
