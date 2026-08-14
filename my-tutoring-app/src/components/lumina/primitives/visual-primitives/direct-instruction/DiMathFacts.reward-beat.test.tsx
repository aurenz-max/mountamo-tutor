// @vitest-environment jsdom
/**
 * Reward-beat behaviour for DiMathFacts (user browser check 2026-07-25: the
 * stage showed the NEXT problem while the LAST answer was still on screen —
 * two facts at once, overload for a five-year-old).
 *
 * The invariant under test: the stage holds exactly ONE fact at a time.
 *   1. before the answer      → the printed problem alone ("3 - 2")
 *   2. tutor affirms          → the SAME fact completes in place ("3 - 2 = 1");
 *                               the next problem is NOT on screen yet
 *   3. tutor's audio falls    → and only then does the next problem appear
 *
 * Step 3 is edge-driven, not timed: the engine sends the next [DI_ITEM] cue
 * 400ms after the tutor's audio falls, so that falling edge is when the tutor
 * stops talking about this fact. The MIN floor keeps a clipped affirmation from
 * flashing the completed equation past the child; the MAX cap releases the
 * stage if the audio edge never arrives at all.
 */
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';

// ── Live context: a mutable bag so a test can drive the audio edge ──────────
const ctxState = {
  isConnected: true,
  isListening: true,
  isAudioPlaying: true,
  sessionMode: 'standalone' as const,
};
const updateContext = vi.fn();
vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    ...ctxState,
    connect: vi.fn(), disconnect: vi.fn(),
    startListening: vi.fn(), stopListening: vi.fn(),
    updateContext,
  }),
}));

const submitResult = vi.fn();
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult, hasSubmitted: false, submittedResult: null,
    elapsedMs: 0, resetAttempt: vi.fn(),
  }),
  useEvaluationContext: () => null,
}));

// The judged-loop engine: capture onEmission so the test can play tutor verdicts.
let emit: (e: LoopEmission) => void = () => {};
const queueCue = vi.fn();
vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: { onEmission?: (e: LoopEmission) => void }) => {
    emit = (e) => options.onEmission?.(e);
    return {
      voiceTurns: { isVoiceActive: () => false, reset: vi.fn() },
      queueCue, sendCueNow: vi.fn(), clearQueuedCue: vi.fn(),
      arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(),
      isAwaitingJudgment: () => false,
      config: {},
    };
  },
}));

import { DiMathFacts } from './DiMathFacts';
import type { DiMathFactsChallenge } from './diMathFactsScript';

/** The two facts from the reported screenshot. */
const CHALLENGES: DiMathFactsChallenge[] = [
  {
    id: 'f1', challengeType: 'subtraction_fact', a: 3, b: 2,
    display: '3 - 2', problem: 'three minus two',
    answerWord: 'one', answerNumeral: 1, solvedDisplay: '3 - 2 = 1',
  },
  {
    id: 'f2', challengeType: 'subtraction_fact', a: 4, b: 0,
    display: '4 - 0', problem: 'four minus zero',
    answerWord: 'four', answerNumeral: 4, solvedDisplay: '4 - 0 = 4',
  },
];

const PACK_DATA = {
  title: 'Quick Flash Practice',
  description: 'Say your answers out loud',
  challenges: CHALLENGES,
  challengeType: 'subtraction_fact' as const,
  gradeLevel: 'kindergarten',
  instanceId: 'test-di-math-facts',
};

const renderPack = () => render(<DiMathFacts data={PACK_DATA} />);

/** The tutor judged the open attempt as correct. */
const affirm = () => act(() => {
  emit({
    kind: 'verdict', judgment: 'affirmed', misses: 0,
    attempt: { openedAt: 0, closedAt: 0 },
  } as unknown as LoopEmission);
});

/** The tutor's line about this fact finished playing. */
const tutorAudioFalls = (view: ReturnType<typeof renderPack>) => act(() => {
  ctxState.isAudioPlaying = false;
  view.rerender(<DiMathFacts data={PACK_DATA} />);
});

describe('DiMathFacts — reward beat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ctxState.isAudioPlaying = true;
    queueCue.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the printed problem alone before the answer', () => {
    renderPack();
    expect(screen.getByText('3 - 2')).toBeTruthy();
    expect(screen.queryByText('4 - 0')).toBeNull();
    expect(screen.queryByText('3 - 2 = 1')).toBeNull();
  });

  it('completes the equation IN PLACE on affirm — the next fact is not on screen yet', () => {
    renderPack();
    affirm();

    // The answered fact completes where the problem was...
    expect(screen.getByText('3 - 2 = 1')).toBeTruthy();
    // ...replacing it, not stacking under it (exact match: '3 - 2' alone is gone).
    expect(screen.queryByText('3 - 2')).toBeNull();
    // THE REGRESSION: the next problem must not be up while the answer shows.
    expect(screen.queryByText('4 - 0')).toBeNull();

    // The next fact's cue still goes out immediately — the engine paces it.
    expect(queueCue).toHaveBeenCalledTimes(1);
  });

  it('advances to the next fact on the tutor-audio falling edge', () => {
    const view = renderPack();
    affirm();
    tutorAudioFalls(view);
    act(() => { vi.advanceTimersByTime(1000); });

    expect(screen.getByText('4 - 0')).toBeTruthy();
    expect(screen.queryByText('3 - 2 = 1')).toBeNull();
  });

  it('holds the completed equation for the floor even if the audio ends at once', () => {
    const view = renderPack();
    affirm();
    tutorAudioFalls(view);

    // Well inside the 900ms floor: the child can still see their answer land.
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText('3 - 2 = 1')).toBeTruthy();
    expect(screen.queryByText('4 - 0')).toBeNull();
  });

  it('releases the stage on the cap when the audio edge never arrives', () => {
    renderPack();
    affirm();
    // No falling edge at all (audio state stuck) — the cap must still advance.
    act(() => { vi.advanceTimersByTime(3200); });

    expect(screen.getByText('4 - 0')).toBeTruthy();
    expect(screen.queryByText('3 - 2 = 1')).toBeNull();
  });

  it('flushes the beat the moment the child answers ahead of it', () => {
    renderPack();
    affirm();
    expect(screen.getByText('3 - 2 = 1')).toBeTruthy();

    // The child starts answering the next fact before the beat released.
    act(() => {
      emit({ kind: 'attempt-open', attempt: { openedAt: 0 } } as unknown as LoopEmission);
    });

    // A resolved fact must never be up while they are answering the next one.
    expect(screen.queryByText('3 - 2 = 1')).toBeNull();
    expect(screen.getByText('4 - 0')).toBeTruthy();
  });
});
